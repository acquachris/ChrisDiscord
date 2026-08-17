import { AttachmentBuilder, BaseMessageOptions, codeBlock, BaseInteraction as DiscordBaseInteraction, EmbedBuilder, GuildMember, InteractionReplyOptions, MessageFlags, RepliableInteraction } from "discord.js";
import { ClientManager } from "client/ClientManager.js";

/** How long to wait before auto-showing a loading state, comfortably inside Discord's 3s ack deadline. */
const AUTO_LOADING_DELAY_MS = 2000;

abstract class BaseInteraction<T extends DiscordBaseInteraction, TBuilder, TArgs extends any[] = []> {
    protected abstract CreateBuilder(...args: TArgs): TBuilder;

    /**
     * Builds a fresh {@link TBuilder} for sending, using a throwaway instance.
     * Args are typed from CreateBuilder's own TArgs — for `DiscordButton`/`BaseSelectMenu`/
     * `DiscordModal` (all `ParameterizedInteraction` subclasses) that's a single
     * `Record<string, string>` params object, e.g. `MyButton.GetBuilder({ itemId: "42" })`.
     */
    public static GetBuilder<TInstance extends BaseInteraction<any, any, any[]>>(
        this: new () => TInstance,
        ...args: TInstance extends BaseInteraction<any, any, infer TArgs> ? TArgs : never
    ): TInstance extends BaseInteraction<any, infer TBuilder, any> ? TBuilder : never {
        const instance = new this();
        return (instance as BaseInteraction<any, any, any[]>).CreateBuilder(...args);
    }

    public abstract ValidateCustomId(customId: string): boolean;

    public readonly requiredRoles: string[] = [];
    public readonly allowedRoles: string[] = [];
    public readonly disallowedRoles: string[] = [];
    public readonly isOwnerOnly: boolean = false;

    public readonly disabled: boolean = false;

    /** Whether this interaction's responses are ephemeral by default. Only affects the first reply/followUp — Discord fixes visibility at that point and editReply can't change it. */
    protected readonly ephemeral: boolean = false;

    private autoLoadingTimer?: NodeJS.Timeout;

    /**
     * The real discord.js reply methods, captured before PatchReplyMethods overwrites the
     * instance's own reply/followUp/editReply/deferReply — everything internal to this
     * class (SafeReply, the auto-loading timer) must call these, never interaction.reply()
     * etc. directly, or it would recurse into its own patched wrapper.
     */
    private original?: {
        reply: (options: any) => Promise<any>;
        followUp: (options: any) => Promise<any>;
        editReply: (options: any) => Promise<any>;
        deferReply: (options?: any) => Promise<any>;
    };

    /** Returns the captured original methods, computing them on the spot if PatchReplyMethods hasn't run yet. */
    private GetOriginalMethods(interaction: RepliableInteraction) {
        return this.original ??= {
            reply: interaction.reply.bind(interaction),
            followUp: interaction.followUp.bind(interaction),
            editReply: interaction.editReply.bind(interaction),
            deferReply: interaction.deferReply.bind(interaction)
        };
    }

    /**
     * Redirects interaction.reply()/followUp()/editReply()/deferReply() on this specific
     * interaction instance through SafeReply, so code in Run() that calls them directly
     * gets the same double-reply protection and auto-loading-edit behavior as code that
     * calls this.SafeReply() explicitly — no opt-in needed.
     *
     * Trade-off: the patched methods always resolve to void, not the Message /
     * InteractionCallbackResponse the real ones can return. Code that needs the sent
     * message back should call interaction.fetchReply() afterward, or use
     * this.SafeReply(...) directly and read its (also void) result — same limitation.
     */
    private PatchReplyMethods(interaction: T): void {
        if (!interaction.isRepliable()) return;

        const original = this.GetOriginalMethods(interaction);
        const redirectToSafeReply = (options: BaseMessageOptions) => this.SafeReply(interaction, options);

        const patched = interaction as unknown as Record<string, unknown>;
        patched.reply = redirectToSafeReply;
        patched.followUp = redirectToSafeReply;
        patched.editReply = redirectToSafeReply;
        patched.deferReply = async (options?: any) => {
            this.DisarmAutoLoading();
            if (interaction.replied || interaction.deferred) return;
            await original.deferReply(options);
        };
    }

    /**
     * Starts a fallback timer that shows a loading embed if nothing has responded before
     * Discord's ack deadline. Uses deferReply() + editReply() rather than reply() so that
     * interaction.deferred (not .replied) ends up true — that's what makes SafeReply later
     * edit this message instead of sending a new followUp.
     */
    private ArmAutoLoading(interaction: T): void {
        this.autoLoadingTimer = setTimeout(() => {
            void (async () => {
                if (!interaction.isRepliable() || interaction.replied || interaction.deferred) return;

                const original = this.GetOriginalMethods(interaction);

                try {
                    await original.deferReply({
                        flags: this.ephemeral ? [MessageFlags.Ephemeral] : undefined
                    });
                    await original.editReply({ embeds: [this.GetLoadingEmbed()] });
                } catch (err) {
                    console.error("[BaseInteraction] Auto-loading reply failed:", err);
                }
            })();
        }, AUTO_LOADING_DELAY_MS);
    }

    private DisarmAutoLoading(): void {
        clearTimeout(this.autoLoadingTimer);
    }

    /** Can be overwritten to customize the loading state shown when a response is about to time out. */
    protected GetLoadingEmbed(): EmbedBuilder {
        return new EmbedBuilder()
            .setColor("Grey")
            .setDescription("⏳ Elaborazione in corso...");
    }

    /**
     * Sends `options` back to the user regardless of the interaction's current state:
     * edits the auto-loading reply if one was already sent, follows up if something else
     * already replied, otherwise replies fresh. Never throws — falls back to a followUp
     * attempt if the primary attempt fails, and only logs if that also fails.
     *
     * Pass `forceEphemeral` to override the class-level `ephemeral` default for this call
     * (only takes effect if this is the first response — Discord can't change visibility
     * on an edit).
     */
    protected async SafeReply(interaction: T, options: BaseMessageOptions, forceEphemeral?: boolean): Promise<void> {
        this.DisarmAutoLoading();

        if (!interaction.isRepliable()) return;

        const original = this.GetOriginalMethods(interaction);
        const ephemeral = forceEphemeral ?? this.ephemeral;
        const explicitFlags = (options as { flags?: InteractionReplyOptions["flags"] }).flags;
        const flags = explicitFlags ?? (ephemeral ? [MessageFlags.Ephemeral] as const : undefined);

        try {
            if (interaction.deferred) {
                await original.editReply(options);
            } else if (interaction.replied) {
                await original.followUp({ ...options, flags });
            } else {
                await original.reply({ ...options, flags });
            }
            return;
        } catch (err) {
            console.error("[BaseInteraction] Reply failed, falling back to followUp:", err);
        }

        try {
            await original.followUp({ ...options, flags });
        } catch (err) {
            console.error("[BaseInteraction] followUp fallback also failed, giving up:", err);
        }
    }

    /**
     * Once permissions have been validated, runs the method.
     * @param interaction 
     */
    protected abstract Run(interaction: T): Promise<void>;
    protected OnError(interaction: T, err: any) {};

    private CheckRequiredRoles(interaction: T): boolean {
        // Allow interaction if no required roles have been defined.
        if(this.requiredRoles.length === 0) return true; 

        // Reject interaction if member doesn't exist
        if(!interaction.member) return false;

        const member = interaction.member as GuildMember;

        const pass = this.requiredRoles.every(
            (roleId) => member.roles.cache.has(roleId)
        );

        return pass;
    }

    private CheckAllowedRoles(interaction: T): boolean {
        // Allow interaction if no allowed roles have been defined.
        if(this.allowedRoles.length === 0) return true; 

        // Reject interaction if member doesn't exist
        if(!interaction.member) return false;

        const member = interaction.member as GuildMember;

        const pass = this.allowedRoles.some(
            (roleId) => member.roles.cache.has(roleId)
        );

        return pass;
    }

    private CheckDisallowedRoles(interaction: T): boolean {
        // Allow interaction if no disallowed roles have been defined.
        if(this.disallowedRoles.length === 0) return true;

        // Reject interaction if member doesn't exist
        if(!interaction.member) return false;

        const member = interaction.member as GuildMember;

        const pass = !this.disallowedRoles.some(
            (roleId) => member.roles.cache.has(roleId)
        );

        return pass;
    }

    private CheckIsOwner(interaction: T): boolean {
        // Allow interaction if command is not owner only.
        if(!this.isOwnerOnly) return true;

        const pass = interaction.user.id === ClientManager.GetInstance().GetOptions().ownerUserId;

        return pass;
    }

    private CheckPermissions(interaction: T): boolean {
        // Always allow owner.
        if(interaction.user.id === ClientManager.GetInstance().GetOptions().ownerUserId) return true;
        
        return this.CheckRequiredRoles(interaction) && this.CheckAllowedRoles(interaction) && this.CheckDisallowedRoles(interaction) && this.CheckIsOwner(interaction);
    }

    public async Execute(interaction: T){
        this.PatchReplyMethods(interaction);
        this.ArmAutoLoading(interaction);

        try {
            // Verify Permissions
            const hasPermissions = this.CheckPermissions(interaction);
            if(!hasPermissions) {
                const embed = new EmbedBuilder()
                    .setTitle("Non autorizzato!")
                    .setColor("Red")
                    .setDescription("Non hai il permesso di eseguire questa operazione!");

                await this.SafeReply(interaction, { embeds: [embed] }, true);
                return;
            }

            // Verify Is Testing Mode
            const isTestingMode = ClientManager.GetInstance().GetOptions().isTestingMode;
            if(isTestingMode && interaction.user.id !== ClientManager.GetInstance().GetOptions().ownerUserId){
                const embed = new EmbedBuilder()
                    .setTitle("Sistema in Manutenzione!")
                    .setColor("Red")
                    .setDescription("Attualmente il sistema in manutenzione! Non è possibile svolgere questa operazione. Ritenta più tardi.");

                await this.SafeReply(interaction, { embeds: [embed] }, true);
                return;
            }

            try {
                await this.Run(interaction as T);
            }catch(error) {
                await this.HandleError(error, interaction);
            }
        } finally {
            this.DisarmAutoLoading();
        }
    }

    private async HandleError(err: any, interaction: T) {
        console.error("An error was caught and sent to System Administrator.")

        try {
            await this.OnError(interaction, err);
        }catch(e){} // Do nothing if it fails.

        const errorCode = crypto.randomUUID().slice(0, 8).toUpperCase();
        const errorName = err?.name ?? "UnknownError";
        const errorMessage = err?.message ?? "Nessun messaggio ricevuto.";
        const errorStack = err?.stack ?? "Nessuno stack ricevuto.";
        const interactionId: string = "customId" in interaction ? interaction.customId as string : "commandName" in interaction ? interaction.commandName as string : "UnknownInteraction";

        const userEmbed = new EmbedBuilder()
            .setTitle("Errore!")
            .setDescription("Il bot ha incontrato un errore durante l'esecuzione dell'operazione.\nContatta l'amministratore di sistema spiegando la situazione e allegando il codice errore.")
            .setColor("Red")
            .addFields(
                { name: ":1234: Codice Errore:", value: codeBlock(errorCode)}
            );

        const guildString = interaction.guild ? `${interaction.guild.name} (${interaction.guild.id})` : "Nessun server."
        const ownerEmbed = new EmbedBuilder()
            .setTitle("Errore Fatale!")
            .setDescription("Il bot ha incontrato un errore fatale.")
            .setColor("Red")
            .addFields(
                { name: ":1234: Codice Errore:", value: codeBlock(errorCode) },
                { name: "👤 Utente:", value: codeBlock(`${interaction.user.username} (${interaction.user.id})`), inline: true },
                { name: "🌍 Server:", value: codeBlock(guildString), inline: true },
                { name: ":hammer: Id Interazione:", value: codeBlock(interactionId), inline: false },
                { name: "🏷️ Classe:", value: codeBlock(this.constructor.name), inline: true },
                { name: ":identification_card: Nome Errore:", value: codeBlock(errorName) },
                { name: ":envelope: Messaggio Errore:", value: codeBlock(errorMessage) },
                { name: ":books: Stack Errore:", value: "```Vedi allegato.```" }
            );

        const errorText = `=== ERRORE RISCONTRATO ===\nNome: ${errorName}\nMessaggio: ${errorMessage}\nStack:\n${errorStack}`;

        const Attachment = new AttachmentBuilder(
            Buffer.from(errorText, "utf-8"),
            { name: `errore_${errorCode}.txt` }
        );

        const ownerUser = interaction.client.users.cache.get(ClientManager.GetInstance().GetOptions().ownerUserId);
        if (ownerUser) {
            await ownerUser.send({
                embeds: [ownerEmbed],
                files: [Attachment]
            });
        }

        await this.SafeReply(interaction, { embeds: [userEmbed] }, true);
    }
}

export { BaseInteraction };
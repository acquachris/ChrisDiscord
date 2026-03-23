import { AttachmentBuilder, codeBlock, BaseInteraction as DiscordBaseInteraction, EmbedBuilder, GuildMember, MessageFlags } from "discord.js";
import { ClientManager } from "client/ClientManager";

abstract class BaseInteraction<T extends DiscordBaseInteraction, TBuilder> {
    protected readonly builder: TBuilder = this.CreateBuilder();
    protected abstract CreateBuilder(): TBuilder;

    public static GetBuilder(this: new () => BaseInteraction<any, any>){
        const instance = new this();
        return instance.builder;
    }

    public abstract ValidateCustomId(customId: string): boolean;

    public readonly requiredRoles: string[] = [];
    public readonly allowedRoles: string[] = [];
    public readonly disallowedRoles: string[] = [];
    public readonly isOwnerOnly: boolean = false;

    public readonly disabled: boolean = false;

    protected abstract Run(interaction: T): Promise<void>;

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
        // Verify Permissions
        const hasPermissions = this.CheckPermissions(interaction);
        if(!hasPermissions) {
            const embed = new EmbedBuilder()
                .setTitle("Non autorizzato!")
                .setColor("Red")
                .setDescription("Non hai il permesso di eseguire questa operazione!");

            if(!interaction.isRepliable()) return;
            await interaction.reply({embeds: [embed], flags: [MessageFlags.Ephemeral]});
            return;
        }

        // Verify Is Testing Mode
        const isTestingMode = ClientManager.GetInstance().GetOptions().isTestingMode;
        if(isTestingMode && interaction.user.id !== ClientManager.GetInstance().GetOptions().ownerUserId){
            const embed = new EmbedBuilder()
                .setTitle("Sistema in Manutenzione!")
                .setColor("Red")
                .setDescription("Attualmente il sistema in manutenzione! Non è possibile svolgere questa operazione. Ritenta più tardi.");

            if(!interaction.isRepliable()) return;
            await interaction.reply({embeds: [embed], flags: [MessageFlags.Ephemeral]});
            return;
        }

        try {
            await this.Run(interaction as T);
        }catch(error) {
            this.HandleError(error, interaction);
        }
    }

    private async HandleError(err: any, interaction: T) {
        console.error("An error was caught and sent to System Administrator.")

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

        if (!interaction.isRepliable()) return;

        const response = { embeds: [userEmbed] };

        if (interaction.replied) {
            await interaction.editReply(response);
        } else {
            await interaction.reply({...response, flags: [MessageFlags.Ephemeral]});
        }
    }
}

export { BaseInteraction };
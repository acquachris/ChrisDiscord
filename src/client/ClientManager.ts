import { AnySelectMenuInteraction, AttachmentBuilder, ButtonInteraction, CacheType, ChatInputCommandInteraction, Client, codeBlock, EmbedBuilder, Interaction, ModalSubmitInteraction, REST, RESTPostAPIChatInputApplicationCommandsJSONBody, Routes } from "discord.js";
import { InteractionRegistry } from "interactions/InteractionRegistry.js";
import { SlashCommand } from "interactions/SlashCommand.js";
import { DiscordButton } from "interactions/DiscordButton.js";
import { BaseSelectMenu } from "interactions/BaseSelectMenu.js";
import { DiscordModal } from "interactions/DiscordModal.js";
import { EventRegistry } from "events/EventRegistry.js";
import { BaseDiscordEvent } from "events/BaseDiscordEvent.js";

interface ClientOptions {
    client: Client;
    isTestingMode?: boolean;
    ownerUserId: string;

    commandFolders?: string[];
    buttonFolders?: string[];
    selectMenuFolders?: string[];
    modalFolders?: string[];
    eventFolders?: string[]

    slashCommandInstances?: SlashCommand[];
    buttonInstances?: DiscordButton[];
    selectMenuInstances?: BaseSelectMenu<any, any>[];
    modalInstances?: DiscordModal[];
    eventInstances?: BaseDiscordEvent[];
}

class ClientManager {
    private static instance: ClientManager;

    private client: Client;
    private options: ClientOptions;

    private slashCommandRegistry: InteractionRegistry<SlashCommand> = new InteractionRegistry<SlashCommand>();
    private buttonCommandRegistry: InteractionRegistry<DiscordButton> = new InteractionRegistry<DiscordButton>();
    private selectMenuRegistry: InteractionRegistry<BaseSelectMenu<any, any>> = new InteractionRegistry<BaseSelectMenu<any, any>>();
    private modalRegistry: InteractionRegistry<DiscordModal> = new InteractionRegistry<DiscordModal>();

    private eventRegistry: EventRegistry = new EventRegistry();
    
    constructor(_options: ClientOptions) {
        ClientManager.instance = this;

        this.options = _options;

        this.client = this.options.client;

        this.Init();
    }

    public GetOptions(): ClientOptions {
        return this.options;
    }

    public GetClient(): Client {
        return this.client;
    }

    public static GetInstance(): ClientManager {
        if(!ClientManager.instance){
            throw new Error("[ClientManager] ClientManager not initialized!");
        }

        return ClientManager.instance;
    }

    private async Init(){
        await this.LoadRegistries();
        await this.RegisterSlashCommand();

        this.client.on("interactionCreate", this.OnInteraction.bind(this));
        this.RegisterEvents();
        this.RegisterGlobalErrorHandlers();
    }

    private async LoadRegistries(){
        // Load Slash Command Registry
        for(const folder of this.options.commandFolders ?? []){
            await this.slashCommandRegistry.LoadFolder(folder);
        }
        this.slashCommandRegistry.LoadInteractions(this.options.slashCommandInstances ?? []);

        // Load Button Registry
        for(const folder of this.options.buttonFolders ?? []){
            await this.buttonCommandRegistry.LoadFolder(folder);
        }
        this.buttonCommandRegistry.LoadInteractions(this.options.buttonInstances ?? []);

        // Load Select Menu Registry
        for(const folder of this.options.selectMenuFolders ?? []){
            await this.selectMenuRegistry.LoadFolder(folder);
        }
        this.selectMenuRegistry.LoadInteractions(this.options.selectMenuInstances ?? []);

        // Load Modal Registry
        for(const folder of this.options.modalFolders ?? []){
            await this.modalRegistry.LoadFolder(folder);
        }
        this.modalRegistry.LoadInteractions(this.options.modalInstances ?? []);

        // Load Event Registry
        for(const folder of this.options.eventFolders ?? []){
            await this.eventRegistry.LoadFolder(folder);
        }
        this.eventRegistry.LoadEvents(this.options.eventInstances ?? []);
    }

    private RegisterEvents(){
        for(const event of this.eventRegistry.GetAllEvents()){
            this.client.on(event.eventName, (...args) => event.Execute(...args));
        }
    }

    private RegisterSlashCommand(){
        if(!this.client.token){
            throw new Error("[ClientManager] Client token not set!");
        }

        const commands = this.slashCommandRegistry.GetInteractions();

        const guildCommandsMap = new Map<string, RESTPostAPIChatInputApplicationCommandsJSONBody[]>();
        const globalCommands: RESTPostAPIChatInputApplicationCommandsJSONBody[] = [];

        // If command has specific guilds
        for (const command of commands) {
            if (command.guilds && command.guilds.length > 0) {
                for (const guildId of command.guilds) {
                    if (!guildCommandsMap.has(guildId)) {
                        guildCommandsMap.set(guildId, []);
                    }

                    guildCommandsMap.get(guildId)!.push(command.GetJSON());
                }
            } else {
                globalCommands.push(command.GetJSON());
            }
        }

        const rest = new REST({ version: "10" }).setToken(this.client.token);

        // Register guild-specific commands
        for (const [guildId, commands] of guildCommandsMap) {
            rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID!, guildId), { body: commands })
                .then(() => console.log(`Registered commands for guild ${guildId}.`))
                .catch(console.error);
        }

        // Register global commands
        rest.put(Routes.applicationCommands(process.env.CLIENT_ID!), { body: globalCommands })
            .then(() => console.log("Global commands registered!"))
            .catch(console.error);
    }

    public async CleanSlashCommands() {
        try {
            const rest = new REST({ version: "10" }).setToken(process.env.TOKEN!);

            await rest.put(Routes.applicationCommands(process.env.CLIENT_ID!), { body: [] });

            const guildIds = Object.values(this.options.client.guilds.cache.map(guild => guild.id));

            for (const guildId of Object.values(guildIds)) {
                await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID!, guildId), { body: [] });
            }
        } catch (error) {
            console.error(error);
        }
    }

    private HandleSlashCommand(interaction: ChatInputCommandInteraction) {
        const command = this.slashCommandRegistry.GetInteraction(interaction.commandName);
        if(!command) return;
        
        command.Execute(interaction);
    }

    private HandleButtonInteraction(interaction: ButtonInteraction){
        const button = this.buttonCommandRegistry.GetInteraction(interaction.customId);
        if(!button) return;

        button.Execute(interaction);
    }

    private HandleSelectMenuInteraction(interaction: AnySelectMenuInteraction){
        const selectMenu = this.selectMenuRegistry.GetInteraction(interaction.customId);
        if(!selectMenu) return;
        
        selectMenu.Execute(interaction);
    }

    private HandleModalInteraction(interaction: ModalSubmitInteraction){
        const modal = this.modalRegistry.GetInteraction(interaction.customId);
        if(!modal) return;

        modal.Execute(interaction);
    }

    private OnInteraction(interaction: Interaction<CacheType>){
        if(interaction.isChatInputCommand()){
            this.HandleSlashCommand(interaction);
            return;
        }

        if(interaction.isButton()){
            this.HandleButtonInteraction(interaction);
            return;
        }

        if(interaction.isAnySelectMenu()){
            this.HandleSelectMenuInteraction(interaction);
            return;
        }

        if(interaction.isModalSubmit()){
            this.HandleModalInteraction(interaction);
            return;
        }
    }

    public RegisterGlobalErrorHandlers() {
        // Catch uncaught exceptions
        process.on("uncaughtException", async (err: any) => {
            console.error("[Global Error] Uncaught Exception detected:", err);
            await this.HandleGlobalError(err, "uncaughtException");
        });

        // Catch unhandled promise rejections
        process.on("unhandledRejection", async (reason: any) => {
            console.error("[Global Error] Unhandled Rejection detected:", reason);
            await this.HandleGlobalError(reason, "unhandledRejection");
        });
    }

    private async HandleGlobalError(err: any, type: string) {
        const errorCode = crypto.randomUUID().slice(0, 8).toUpperCase();
        const errorName = err?.name ?? "UnknownError";
        const errorMessage = err?.message ?? "Nessun messaggio ricevuto.";
        const errorStack = err?.stack ?? "Nessuno stack ricevuto.";

        const ownerEmbed = new EmbedBuilder()
            .setTitle("Errore Globale!")
            .setDescription(`Il bot ha incontrato un errore globale (${type}).`)
            .setColor("Red")
            .addFields(
                { name: ":1234: Codice Errore:", value: codeBlock(errorCode) },
                { name: "🏷️ Classe:", value: codeBlock(this.constructor.name), inline: true },
                { name: ":identification_card: Nome Errore:", value: codeBlock(errorName) },
                { name: ":envelope: Messaggio Errore:", value: codeBlock(errorMessage) },
                { name: ":books: Stack Errore:", value: "```Vedi allegato.```" }
            );

        const errorText = `=== ERRORE GLOBALE ===\nTipo: ${type}\nNome: ${errorName}\nMessaggio: ${errorMessage}\nStack:\n${errorStack}`;
        const attachment = new AttachmentBuilder(Buffer.from(errorText, "utf-8"), { name: `errore_${errorCode}.txt` });

        const client = this.GetClient();
        const ownerUser = client.users.cache.get(this.options.ownerUserId);
        if (ownerUser) {
            await ownerUser.send({
                embeds: [ownerEmbed],
                files: [attachment]
            });
        }
    }
}

export { ClientManager };
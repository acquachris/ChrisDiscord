import { ChatInputCommandInteraction, RESTPostAPIChatInputApplicationCommandsJSONBody, SlashCommandBuilder } from "discord.js";
import { BaseInteraction } from "interactions/BaseInteraction.js";

abstract class SlashCommand extends BaseInteraction<ChatInputCommandInteraction, SlashCommandBuilder> {
    private _builder?: SlashCommandBuilder;
    private commandJson?: RESTPostAPIChatInputApplicationCommandsJSONBody;

    /**
     * Lazily built on first access (never as a field initializer), so that a subclass's
     * own fields are already set by the time its CreateBuilder() override runs.
     */
    protected get builder(): SlashCommandBuilder {
        return this._builder ??= this.CreateBuilder();
    }

    public ValidateCustomId(name: string): boolean {
        return this.builder.name === name;
    }

    public readonly guilds: string[] = [];

    protected abstract Run(interaction: ChatInputCommandInteraction): Promise<void>;

    public GetJSON(): RESTPostAPIChatInputApplicationCommandsJSONBody{
        if(this.commandJson){
            return this.commandJson;
        }

        if (this.disabled) {
            this.builder.setDescription(
                `[Disabilitato] ${this.builder.description}`
            );
        }

        if(this.isOwnerOnly){
            this.builder.setDescription(
                `[Amministratore] ${this.builder.description}`
            )
        }

        this.commandJson = this.builder.toJSON();

        return this.commandJson;
    }
}

export { SlashCommand };
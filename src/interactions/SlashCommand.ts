import { ChatInputCommandInteraction, RESTPostAPIChatInputApplicationCommandsJSONBody, SlashCommandBuilder } from "discord.js";
import { BaseInteraction } from "interactions/BaseInteraction.js";

abstract class SlashCommand extends BaseInteraction<ChatInputCommandInteraction, SlashCommandBuilder> {
    public readonly builder: SlashCommandBuilder = this.CreateBuilder();
    private commandJson?: RESTPostAPIChatInputApplicationCommandsJSONBody;

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
import { ButtonBuilder, ButtonInteraction, ButtonStyle } from "discord.js";
import { ParameterizedInteraction } from "./ParameterizedInteraction";

abstract class DiscordButton extends ParameterizedInteraction<ButtonInteraction, ButtonBuilder> {
    // Can be overwritten
    public ValidateCustomId(customId: string): boolean {
        if (this.builder.data.style === ButtonStyle.Link) return false;

        return this.TestParamRegex(customId);
    }

    protected abstract Run(interaction: ButtonInteraction): Promise<void>;
}

export { DiscordButton };
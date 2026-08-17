import { ButtonBuilder, ButtonInteraction } from "discord.js";
import { ParameterizedInteraction } from "./ParameterizedInteraction.js";

abstract class DiscordButton extends ParameterizedInteraction<ButtonInteraction, ButtonBuilder> {
    protected abstract Run(interaction: ButtonInteraction): Promise<void>;
}

export { DiscordButton };
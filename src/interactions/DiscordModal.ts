import { ModalBuilder, ModalSubmitInteraction } from "discord.js";
import { ParameterizedInteraction } from "interactions/ParameterizedInteraction.js";

abstract class DiscordModal extends ParameterizedInteraction<ModalSubmitInteraction, ModalBuilder> {
    protected abstract Run(interaction: ModalSubmitInteraction): Promise<void>;
}

export { DiscordModal };
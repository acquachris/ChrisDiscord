import { ModalBuilder, ModalSubmitInteraction } from "discord.js";
import { ParameterizedInteraction } from "interactions/ParameterizedInteraction";

abstract class DiscordModal extends ParameterizedInteraction<ModalSubmitInteraction, ModalBuilder> {
    public ValidateCustomId(customId: string): boolean {
        return this.TestParamRegex(customId);
    }

    protected abstract Run(interaction: ModalSubmitInteraction): Promise<void>;
}

export { DiscordModal };
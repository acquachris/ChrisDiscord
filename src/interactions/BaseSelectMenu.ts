import { AnySelectMenuInteraction, BaseSelectMenuBuilder } from "discord.js";
import { ParameterizedInteraction } from "interactions/ParameterizedInteraction";

abstract class BaseSelectMenu<TInteraction extends AnySelectMenuInteraction, TBuilder extends BaseSelectMenuBuilder<any>> extends ParameterizedInteraction<TInteraction, TBuilder> {
    // Can be overwritten
    public ValidateCustomId(customId: string): boolean {
        return this.TestParamRegex(customId);
    }

    protected abstract Run(interaction: TInteraction): Promise<void>;
}

export { BaseSelectMenu };
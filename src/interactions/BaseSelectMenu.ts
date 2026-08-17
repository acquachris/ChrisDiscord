import { AnySelectMenuInteraction, BaseSelectMenuBuilder } from "discord.js";
import { ParameterizedInteraction } from "interactions/ParameterizedInteraction.js";

abstract class BaseSelectMenu<
    TInteraction extends AnySelectMenuInteraction,
    TBuilder extends BaseSelectMenuBuilder<any>
> extends ParameterizedInteraction<TInteraction, TBuilder> {
    protected abstract Run(interaction: TInteraction): Promise<void>;
}

export { BaseSelectMenu };
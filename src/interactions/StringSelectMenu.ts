import { StringSelectMenuBuilder, StringSelectMenuInteraction } from "discord.js";
import { BaseSelectMenu } from "interactions/BaseSelectMenu.js";

abstract class StringSelectMenu extends BaseSelectMenu<StringSelectMenuInteraction, StringSelectMenuBuilder> {
    protected abstract Run(interaction: StringSelectMenuInteraction): Promise<void>;
}

export { StringSelectMenu };
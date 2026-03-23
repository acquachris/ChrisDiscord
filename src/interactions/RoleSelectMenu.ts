import { RoleSelectMenuBuilder, RoleSelectMenuInteraction } from "discord.js";
import { BaseSelectMenu } from "interactions/BaseSelectMenu";

abstract class RoleSelectMenu extends BaseSelectMenu<RoleSelectMenuInteraction, RoleSelectMenuBuilder> {
    protected abstract Run(interaction: RoleSelectMenuInteraction): Promise<void>;
}

export { RoleSelectMenu };
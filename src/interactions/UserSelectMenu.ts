import { UserSelectMenuBuilder, UserSelectMenuInteraction } from "discord.js";
import { BaseSelectMenu } from "interactions/BaseSelectMenu";

abstract class UserSelectMenu extends BaseSelectMenu<UserSelectMenuInteraction, UserSelectMenuBuilder> {
    abstract builder: UserSelectMenuBuilder;

    protected abstract Run(interaction: UserSelectMenuInteraction): Promise<void>;
}

export { UserSelectMenu };
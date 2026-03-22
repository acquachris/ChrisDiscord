import { ChannelSelectMenuBuilder, ChannelSelectMenuInteraction } from "discord.js";
import { BaseSelectMenu } from "interactions/BaseSelectMenu";

abstract class ChannelSelectMenu extends BaseSelectMenu<ChannelSelectMenuInteraction, ChannelSelectMenuBuilder> {
    protected abstract Run(interaction: ChannelSelectMenuInteraction): Promise<void>;
}

export { ChannelSelectMenu} ;
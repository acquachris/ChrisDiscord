import {
    Message,
    ActionRowBuilder,
    ButtonBuilder,
    StringSelectMenuBuilder,
    RoleSelectMenuBuilder,
    UserSelectMenuBuilder,
    ChannelSelectMenuBuilder,
    MentionableSelectMenuBuilder,
    ButtonComponent,
    StringSelectMenuComponent,
    RoleSelectMenuComponent,
    UserSelectMenuComponent,
    ChannelSelectMenuComponent,
    MentionableSelectMenuComponent,
    ComponentType,
    ActionRow,
    MessageActionRowComponent,
    MessageActionRowComponentBuilder,
} from "discord.js";

export function DisableMessageComponents(message: Message): ActionRowBuilder<MessageActionRowComponentBuilder>[] {
    return message.components
        .filter((row): row is ActionRow<MessageActionRowComponent> => row.type === ComponentType.ActionRow)
        .map((row) => {
            const newRow = new ActionRowBuilder<MessageActionRowComponentBuilder>();

            const disabledComponents = row.components.map((component: MessageActionRowComponent) => {
                switch (component.type) {
                    case ComponentType.Button: {
                        return ButtonBuilder.from(component as ButtonComponent).setDisabled(true);
                    }
                    case ComponentType.StringSelect: {
                        return StringSelectMenuBuilder.from(component as StringSelectMenuComponent).setDisabled(true);
                    }
                    case ComponentType.RoleSelect: {
                        return RoleSelectMenuBuilder.from(component as RoleSelectMenuComponent).setDisabled(true);
                    }
                    case ComponentType.UserSelect: {
                        return UserSelectMenuBuilder.from(component as UserSelectMenuComponent).setDisabled(true);
                    }
                    case ComponentType.ChannelSelect: {
                        return ChannelSelectMenuBuilder.from(component as ChannelSelectMenuComponent).setDisabled(true);
                    }
                    case ComponentType.MentionableSelect: {
                        return MentionableSelectMenuBuilder.from(component as MentionableSelectMenuComponent).setDisabled(true);
                    }
                    default: {
                        return component;
                    }
                }
            });

            newRow.addComponents(disabledComponents as MessageActionRowComponentBuilder[]);
            return newRow;
        });
}
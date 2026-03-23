import { ActionRowBuilder, BaseInteraction, ButtonBuilder, ButtonInteraction, ButtonStyle, ColorResolvable, Colors, ComponentType, EmbedBuilder } from "discord.js";

interface ConfirmationPanelOptions {
    interaction: BaseInteraction
    embedTitle?: string;
    embedDescription?: string;
    embedColor?: ColorResolvable;
    onConfirm: (i: ButtonInteraction) => Promise<void> | void;
    onCancel?: (i: ButtonInteraction) => Promise<void> | void;
    timeout?: number;

    confirmButtonLabel?: string;
    cancelButtonLabel?: string;
    confirmButtonEmoji?: string;
    cancelButtonEmoji?: string;
    confirmButtonStyle?: ButtonStyle;
    cancelButtonStyle?: ButtonStyle;
}

class ConfirmationPanel {
    public static async Create (options: ConfirmationPanelOptions) {
        const { 
            interaction, 
            embedTitle = "Sei sicuro?", 
            embedDescription = "Sei sicuro di voler svolgere questa operazione?", 
            embedColor = Colors.Blue, 
            onConfirm, 
            onCancel, 
            timeout = 30_000,

            confirmButtonLabel = "Conferma", 
            cancelButtonLabel = "Annulla", 
            confirmButtonEmoji = "✅", 
            cancelButtonEmoji = "✖️", 
            confirmButtonStyle = ButtonStyle.Success, 
            cancelButtonStyle = ButtonStyle.Danger,
        } = options;

        if(!interaction.isRepliable()){
            throw new Error("[ConfirmationPanel] Interaction must be repliable");
        }

        if(!interaction.channel){
            throw new Error("[ConfirmationPanel] Interaction must have a channel");
        }

        const confirmButton = new ButtonBuilder()
            .setCustomId(`confirmpanel:confirm:${interaction.id}`)
            .setLabel(confirmButtonLabel)
            .setStyle(confirmButtonStyle)
            .setEmoji(confirmButtonEmoji);

        const cancelButton = new ButtonBuilder()
            .setCustomId(`confirmpanel:cancel:${interaction.id}`)
            .setLabel(cancelButtonLabel)
            .setStyle(cancelButtonStyle)
            .setEmoji(cancelButtonEmoji);

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(confirmButton, cancelButton);

        const embed = new EmbedBuilder()
            .setTitle(embedTitle)
            .setDescription(embedDescription)
            .setColor(embedColor)
            
        const response = await interaction.reply({
            embeds: [embed],
            components: [row],
        });

        try {
            const collector = interaction.channel.createMessageComponentCollector({
                componentType: ComponentType.Button,
                filter: (i) => i.user.id === interaction.user.id && i.customId.startsWith(`confirmpanel:`) && i.customId.endsWith(interaction.id),
                time: timeout,
                max: 1,
            });

            collector.on("collect", async (i) => {
                if(!i.isButton()) return;

                const action = i.customId.split(":")[1];

                if (action === "confirm") {
                    collector.stop("success");
                    await onConfirm(i);
                } else {
                    if(onCancel){
                        await onCancel(i);
                    }else{
                        i.deferUpdate();
                    }

                    collector.stop("cancelled");
                }
            });

            collector.on("end", (collected, reason) => {
                if (reason === "cancelled") {
                    confirmButton.setStyle(ButtonStyle.Secondary);
                } else if (reason === "success") {
                    cancelButton.setStyle(ButtonStyle.Secondary);
                } else {
                    cancelButton.setStyle(ButtonStyle.Secondary);
                    confirmButton.setStyle(ButtonStyle.Secondary);
                }

                cancelButton.setDisabled(true);
                confirmButton.setDisabled(true);
                row.setComponents(confirmButton, cancelButton);

                response.edit({
                    embeds: [embed],
                    components: [row],
                });
            });
        } catch (e) {
            throw new Error(`[ConfirmationPanel] ${e}`);
        }
    } 
}

export { ConfirmationPanel, ConfirmationPanelOptions };
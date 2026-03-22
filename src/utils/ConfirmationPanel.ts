import { ActionRowBuilder, BaseInteraction, ButtonBuilder, ButtonStyle, ColorResolvable, Colors, EmbedBuilder } from "discord.js";

interface ConfirmationPanelOptions {
    interaction: BaseInteraction
    embedTitle?: string;
    embedDescription?: string;
    embedColor?: ColorResolvable;
    onConfirm: () => Promise<void> | void;
    onCancel?: () => Promise<void> | void;
    timeout?: number;
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
            timeout = 30_000 
        } = options;

        if(!interaction.isRepliable()){
            throw new Error("[ConfirmationPanel] Interaction must be repliable");
        }

        const confirmButton = new ButtonBuilder()
            .setCustomId(`confirmpanel:confirm:${interaction.id}`)
            .setLabel("Conferma")
            .setStyle(ButtonStyle.Success)
            .setEmoji("✅");

        const cancelButton = new ButtonBuilder()
            .setCustomId(`confirmpanel:cancel:${interaction.id}`)
            .setLabel("Annulla")
            .setStyle(ButtonStyle.Danger)
            .setEmoji("✖️");

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
            const collector = await response.createMessageComponentCollector({
                filter: (i) => i.user.id === interaction.user.id && i.customId.startsWith(`confirmpanel:`) && i.customId.endsWith(interaction.id),
                time: timeout,
            });

            collector.on("collect", async (i) => {
                const action = i.customId.split(":")[1];

                if (action === "confirm") {
                    await onConfirm();

                    collector.stop("success");
                } else {
                    if (onCancel) await onCancel();

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
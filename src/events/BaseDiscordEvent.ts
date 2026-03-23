import { ClientManager } from "client/ClientManager.js";
import { AttachmentBuilder, ClientEvents, codeBlock, EmbedBuilder } from "discord.js";

abstract class BaseDiscordEvent<T extends any[] = any[]> {
    public abstract readonly eventName: keyof ClientEvents;    

    public ValidateEvent(eventName: string): boolean {
        return this.eventName === eventName;
    }

    public async Execute(...args: T) {
        try{
            await this.Run(...args);
        }catch(error) {
            this.HandleError(error);
        }
    }

    protected abstract Run(...args: T): Promise<void>;

    private async HandleError(err: any) {
        console.error("An error was caught and sent to System Administrator.")

        const errorCode = crypto.randomUUID().slice(0, 8).toUpperCase();
        const errorName = err?.name ?? "UnknownError";
        const errorMessage = err?.message ?? "Nessun messaggio ricevuto.";
        const errorStack = err?.stack ?? "Nessuno stack ricevuto.";

        const ownerEmbed = new EmbedBuilder()
            .setTitle("Errore Fatale!")
            .setDescription("Il bot ha incontrato un errore fatale.")
            .setColor("Red")
            .addFields(
                { name: ":1234: Codice Errore:", value: codeBlock(errorCode) },
                { name: ":hammer: Evento:", value: codeBlock(this.eventName), inline: true },
                { name: "🏷️ Classe:", value: codeBlock(this.constructor.name), inline: true },
                { name: ":identification_card: Nome Errore:", value: codeBlock(errorName) },
                { name: ":envelope: Messaggio Errore:", value: codeBlock(errorMessage) },
                { name: ":books: Stack Errore:", value: "```Vedi allegato.```" }
            );

        const errorText = `=== ERRORE NON GESTITO ===\nNome: ${errorName}\nMessaggio: ${errorMessage}\nStack:\n${errorStack}`;

        const attachment = new AttachmentBuilder(
            Buffer.from(errorText, "utf-8"),
            { name: `errore_${errorCode}.txt` }
        );

        const client = ClientManager.GetInstance().GetClient();
        const ownerUser = client.users.cache.get(ClientManager.GetInstance().GetOptions().ownerUserId);
        if (ownerUser) {
            await ownerUser.send({
                embeds: [ownerEmbed],
                files: [attachment]
            });
        }
    }
}

export { BaseDiscordEvent };
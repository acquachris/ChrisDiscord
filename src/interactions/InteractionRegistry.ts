import * as fs from "fs";
import * as path from "path";
import { BaseInteraction } from "./BaseInteraction";

class InteractionRegistry<T extends BaseInteraction<any, any>> {
    private interactions: T[] = [];

    public async LoadFolder(folder: string) {
        // Detect dev vs prod automatically
        const isDev = __dirname.includes("src"); 

        // In dev, folder is relative to src
        // In prod, folder is relative to dist (no src inside dist)
        const baseFolder = isDev
            ? path.join(__dirname, folder)         // dev -> src/commands
            : path.join(__dirname, folder.replace(/^src\//, "")); // prod -> commands

        if (!fs.existsSync(baseFolder)) return; // prevent ENOENT

        const entries = fs.readdirSync(baseFolder, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(baseFolder, entry.name);

            if (entry.isDirectory()) {
                await this.LoadFolder(path.join(folder, entry.name));
                continue;
            }

            // Only load appropriate files
            if (!entry.name.endsWith(".js") && !(isDev && entry.name.endsWith(".ts"))) continue;

            const module = require(fullPath);
            const InteractionClass = module.default ?? module;

            if (!(InteractionClass.prototype instanceof BaseInteraction)) continue;

            const instance = new InteractionClass() as T;
            this.interactions.push(instance);
        }
    }

    public LoadInteractions(interactionClasses: T[]) {
        this.interactions.push(...interactionClasses);
    }

    public GetInteractions(): T[] {
        return this.interactions;
    }

    public GetInteraction(customId: string) {
        return this.interactions.find(interaction => interaction.ValidateCustomId(customId));
    }
}

export { InteractionRegistry };
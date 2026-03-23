import * as fs from "fs";
import * as path from "path";
import { BaseInteraction } from "./BaseInteraction.js";

class InteractionRegistry<T extends BaseInteraction<any, any>> {
    private interactions: T[] = [];

    public async LoadFolder(folder: string) {
        const baseFolder = path.resolve(folder);
        const entries = fs.readdirSync(baseFolder, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(baseFolder, entry.name);

            if (entry.isDirectory()) {
                await this.LoadFolder(fullPath);
                continue;
            }

            if (!entry.name.endsWith(".js") && !entry.name.endsWith(".ts")) continue;

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
import * as fs from "fs";
import * as path from "path";
import { pathToFileURL } from "url";
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

            const module = await import(pathToFileURL(fullPath).href);
            let InteractionClass = module.default ?? module;

            // When a CJS file (e.g. tsc-compiled `export default`) is loaded via dynamic
            // import(), Node's interop puts the whole `module.exports` object (itself
            // carrying a `.default`) on the namespace's `default`, instead of unwrapping it
            // like require() does. Unwrap that extra layer here.
            if (typeof InteractionClass !== "function" && InteractionClass?.default) {
                InteractionClass = InteractionClass.default;
            }

            if (typeof InteractionClass !== "function" || !(InteractionClass.prototype instanceof BaseInteraction)) continue;

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
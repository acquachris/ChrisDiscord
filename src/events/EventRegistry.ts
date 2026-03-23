import * as fs from "fs";
import * as path from "path";
import { BaseDiscordEvent } from "./BaseDiscordEvent";

class EventRegistry {
    private events: BaseDiscordEvent[] = [];

    public async LoadFolder(folder: string) {
        // Detect dev vs prod
        const isDev = __dirname.includes("src");

        // Adjust path: in prod, remove leading "src/" if present
        const baseFolder = path.isAbsolute(folder)
            ? folder
            : path.join(__dirname, isDev ? folder : folder.replace(/^src[\\/]/, ""));

        if (!fs.existsSync(baseFolder)) return; // prevent ENOENT

        const entries = fs.readdirSync(baseFolder, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(baseFolder, entry.name);

            if (entry.isDirectory()) {
                // recurse into subfolders
                await this.LoadFolder(path.join(folder, entry.name));
                continue;
            }

            // Only load appropriate files
            if (!entry.name.endsWith(".js") && !(isDev && entry.name.endsWith(".ts"))) continue;

            const module = require(fullPath);
            const EventClass = module.default ?? module;

            if (!(EventClass.prototype instanceof BaseDiscordEvent)) continue;

            const instance = new EventClass() as BaseDiscordEvent;
            this.events.push(instance);
        }
    }

    public LoadEvents(events: BaseDiscordEvent[]) {
        this.events.push(...events);
    }

    public GetAllEvents(): BaseDiscordEvent[] {
        return this.events;
    }

    public GetEvents(eventName: string): BaseDiscordEvent[] {
        return this.events.filter(event => event.ValidateEvent(eventName));
    }
}

export { EventRegistry };
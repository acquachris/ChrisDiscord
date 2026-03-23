import * as fs from "fs";
import * as path from "path";
import { BaseDiscordEvent } from "events/BaseDiscordEvent.js";
import { pathToFileURL } from "url";

class EventRegistry {
    private events: BaseDiscordEvent[] = [];

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

            // Use dynamic import() instead of require()
            const module = await import(pathToFileURL(fullPath).href);
            const EventClass = module.default ?? module;

            if (typeof EventClass !== "function" || !(EventClass.prototype instanceof BaseDiscordEvent)) continue;

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
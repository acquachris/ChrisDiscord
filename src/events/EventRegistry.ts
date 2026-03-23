import * as fs from "fs";
import * as path from "path";
import { BaseDiscordEvent } from "events/BaseDiscordEvent";

class EventRegistry {
    private events: BaseDiscordEvent[] = [];

    public async LoadFolder(folder: string){
        const resolvedFolder = path.isAbsolute(folder) ? folder : path.resolve(process.cwd(), folder);

        const entries = fs.readdirSync(resolvedFolder, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(resolvedFolder, entry.name);

            if (entry.isDirectory()) {
                await this.LoadFolder(fullPath);
                continue;
            }

            if (!entry.name.endsWith(".js") && !entry.name.endsWith(".ts")) continue;

            const module = require(fullPath);
            const EventClass = module.default ?? module;

            if (!(EventClass.prototype instanceof BaseDiscordEvent)) continue;

            const instance = new EventClass() as BaseDiscordEvent;
            this.events.push(instance);
        }
    }

    public LoadEvents(interactionClasses: BaseDiscordEvent[]){
        this.events.push(...interactionClasses);
    }

    public GetAllEvents(): BaseDiscordEvent[] {
        return this.events;
    }

    public GetEvents(eventName: string): BaseDiscordEvent[]{
        return this.events.filter(
            interaction => interaction.ValidateEvent(eventName)
        );
    }
};

export { EventRegistry };
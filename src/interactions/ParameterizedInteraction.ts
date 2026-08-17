import { BaseInteraction } from "interactions/BaseInteraction.js";
import { BuilderWithCustomId } from "types/BuilderWithCustomId.js";
import { BaseInteraction as DiscordBaseInteraction } from "discord.js";

abstract class ParameterizedInteraction<
    TInteraction extends DiscordBaseInteraction,
    TBuilder extends BuilderWithCustomId
> extends BaseInteraction<TInteraction, TBuilder, [params?: Record<string, string>]> {
    /**
     * customId template with `{key}` placeholders, e.g. `"deleteItem:{itemId}"`.
     * Used for routing incoming interactions and for encoding/decoding params —
     * doesn't require building a builder, so it must be a plain field, not derived
     * from CreateBuilder().
     */
    protected abstract readonly customIdTemplate: string;

    private BuildRegex(): RegExp {
        const pattern = this.customIdTemplate.replace(/\{[^}]+\}/g, "([^:]+)");
        return new RegExp(`^${pattern}$`);
    }

    public ValidateCustomId(customId: string): boolean {
        return this.BuildRegex().test(customId);
    }

    /** Fills the `{key}` placeholders in customIdTemplate using the given params. */
    protected EncodeCustomId(params: Record<string, string> = {}): string {
        return Object.entries(params).reduce(
            (id, [key, value]) => id.replaceAll(`{${key}}`, value),
            this.customIdTemplate
        );
    }

    /** Extracts `{key}` values from a customId matching customIdTemplate, or null if it doesn't match. */
    protected DecodeCustomId(customId: string): Record<string, string> | null {
        const keys = Array.from(this.customIdTemplate.matchAll(/\{([^}]+)\}/g)).map(match => match[1]);

        const match = customId.match(this.BuildRegex());
        if (!match) return null;

        const values = match.slice(1);
        const params: Record<string, string> = {};
        keys.forEach((key, index) => {
            params[key] = values[index];
        });

        return params;
    }
}

export { ParameterizedInteraction };
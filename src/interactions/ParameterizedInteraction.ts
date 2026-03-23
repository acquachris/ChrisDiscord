import { BaseInteraction } from "interactions/BaseInteraction";
import { BuilderWithCustomId } from "interfaces/BuilderWithCustomId";
import { APIButtonComponentWithCustomId, BaseInteraction as DiscordBaseInteraction } from "discord.js";

abstract class ParameterizedInteraction<TInteraction extends DiscordBaseInteraction, TBuilder extends BuilderWithCustomId> extends BaseInteraction<TInteraction, TBuilder> {
    private ApplyParams(customId: string, params: Record<string, string>): string {
        return Object.entries(params).reduce(
            (id, [key, value]) => id.replaceAll(`{${key}}`, value),
            customId
        );
    }

    public static GetBuilder<
        TInteraction extends DiscordBaseInteraction,
        TBuilder extends BuilderWithCustomId,
        TInstance extends ParameterizedInteraction<TInteraction, TBuilder>
    >(
        this: new () => TInstance,
        params: Record<string, string> = {}
    ): TBuilder {
        const instance = new this();
        const builder = instance.builder;

        if (builder.data.custom_id) {
            (builder.data as any).custom_id = instance.ApplyParams(
                builder.data.custom_id,
                params
            );
        }

        return builder;
    }

    protected ParseParams(customId: string): Record<string, string> | null {
        const data = this.builder.data as APIButtonComponentWithCustomId;
        const template = data.custom_id;

        // Extract param names from template
        const keys = Array.from(template.matchAll(/\{([^}]+)\}/g)).map(match => match[1]);

        // Build regex pattern
        const pattern = template.replace(/\{[^}]+\}/g, "([^:]+)");
        const regex = new RegExp(`^${pattern}$`);

        const match = customId.match(regex);
        if (!match) return null;

        // Map values to keys
        const values = match.slice(1);

        const params: Record<string, string> = {};

        keys.forEach((key, index) => {
            params[key] = values[index];
        });

        return params;
    }

    protected TestParamRegex(customId: string) {
        const data = this.builder.data as APIButtonComponentWithCustomId;
        const template = data.custom_id;

        const pattern = template.replace(/\{[^}]+\}/g, "([^:]+)");
        const regex = new RegExp(`^${pattern}$`);
        return regex.test(customId);
    }
}

export { ParameterizedInteraction };
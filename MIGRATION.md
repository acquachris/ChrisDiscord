# Migration Guide

This covers a breaking change to how `DiscordButton`, `BaseSelectMenu` (and its
`StringSelectMenu`/`ChannelSelectMenu`/`RoleSelectMenu`/`UserSelectMenu`), `DiscordModal`,
and `SlashCommand` are extended. If you have interaction classes in your bot, they need
small updates — see below.

## Why

Previously, every interaction class built its `builder` once, eagerly, with no arguments:

```ts
protected readonly builder: TBuilder = this.CreateBuilder();
protected abstract CreateBuilder(): TBuilder;
```

That made it impossible for a subclass to bake custom, per-invocation data (a user ID, an
item ID, etc.) into the builder it sends — the customId's `{key}` placeholders could only
be resolved by string-substituting into an already-built builder, so nothing else about the
builder (label, style, options...) could vary per call, and routing (matching an incoming
interaction back to the right class) depended on that eagerly-built `builder` existing,
which broke the moment `CreateBuilder` needed real arguments to run.

`CreateBuilder` now takes arguments, and routing no longer depends on ever constructing a
builder — it reads a plain `customIdTemplate` field instead.

## What changed

### `CreateBuilder` takes a params object

`DiscordButton`, `BaseSelectMenu`, and `DiscordModal` (all subclasses of
`ParameterizedInteraction`) now take a single `Record<string, string>` params argument,
instead of being built with zero arguments:

```ts
protected abstract CreateBuilder(params?: Record<string, string>): TBuilder;
public static GetBuilder(params?: Record<string, string>): TBuilder;
```

### Routing reads a plain template field, not a built builder

You still declare a `customIdTemplate` with `{key}` placeholders, same as before — but it's
now its own field rather than embedded in a builder that has to be constructed first:

```ts
protected abstract readonly customIdTemplate: string; // e.g. "deleteItem:{itemId}"
```

Two protected helpers replace the old `ApplyParams`/`ParseParams`/`TestParamRegex`:

- `this.EncodeCustomId(params?: Record<string, string>): string` — call inside
  `CreateBuilder` to fill in the template's placeholders and get the real customId.
- `this.DecodeCustomId(customId: string): Record<string, string> | null` — call inside
  `Run` to recover the params, keyed by name. Returns `null` if the customId doesn't match
  the template.

`ValidateCustomId` is provided for you (it matches `customIdTemplate`'s pattern) — you no
longer need to override it.

### `SlashCommand.builder` is still there, just lazier

If you referenced `this.builder` inside a `SlashCommand` subclass's own field initializers,
that will now behave *correctly* instead of seeing `undefined` — `builder` is built lazily
on first access rather than eagerly before your subclass's fields were set. No API change
needed on your end for slash commands.

## How to migrate

### Buttons

```ts
// Before
class DeleteButton extends DiscordButton {
    protected CreateBuilder(): ButtonBuilder {
        return new ButtonBuilder()
            .setCustomId("delete:{itemId}")
            .setLabel("Delete")
            .setStyle(ButtonStyle.Danger);
    }

    protected async Run(interaction: ButtonInteraction) {
        const params = this.ParseParams(interaction.customId);
        const itemId = params?.itemId;
        // ...
    }
}

DeleteButton.GetBuilder({ itemId: "42" });
```

```ts
// After
class DeleteButton extends DiscordButton {
    protected readonly customIdTemplate = "delete:{itemId}";

    protected CreateBuilder(params: Record<string, string> = {}): ButtonBuilder {
        return new ButtonBuilder()
            .setCustomId(this.EncodeCustomId(params))
            .setLabel(`Delete ${params.itemId ?? ""}`) // now free to use params beyond the customId too
            .setStyle(ButtonStyle.Danger);
    }

    protected async Run(interaction: ButtonInteraction) {
        const params = this.DecodeCustomId(interaction.customId);
        const itemId = params?.itemId;
        // ...
    }
}

DeleteButton.GetBuilder({ itemId: "42" }); // same call shape as before
```

If a button needs no params at all, just call `CreateBuilder()`/`GetBuilder()` with none —
the params argument is optional and defaults to `{}`.

### Select menus (same pattern)

```ts
class PickRoleMenu extends RoleSelectMenu {
    protected readonly customIdTemplate = "pickRole:{promptId}";

    protected CreateBuilder(params: Record<string, string> = {}): RoleSelectMenuBuilder {
        return new RoleSelectMenuBuilder()
            .setCustomId(this.EncodeCustomId(params))
            .setPlaceholder("Choose a role");
    }

    protected async Run(interaction: RoleSelectMenuInteraction) {
        const params = this.DecodeCustomId(interaction.customId);
        const promptId = params?.promptId;
        // ...
    }
}
```

`StringSelectMenu`, `ChannelSelectMenu`, and `UserSelectMenu` all follow the same shape.

### Modals

```ts
class FeedbackModal extends DiscordModal {
    protected readonly customIdTemplate = "feedback:{userId}";

    protected CreateBuilder(params: Record<string, string> = {}): ModalBuilder {
        return new ModalBuilder()
            .setCustomId(this.EncodeCustomId(params))
            .setTitle("Feedback");
    }

    protected async Run(interaction: ModalSubmitInteraction) {
        const params = this.DecodeCustomId(interaction.customId);
        const userId = params?.userId;
        // ...
    }
}
```

### Checklist

- [ ] Move your `{key}` customId string out of `CreateBuilder`'s `.setCustomId(...)` call
      and into its own `protected readonly customIdTemplate = "..."` field.
- [ ] Remove any `ValidateCustomId` override that just delegated to `TestParamRegex` — it's
      inherited now.
- [ ] Replace `.setCustomId("literal:{key}")` in `CreateBuilder` with
      `.setCustomId(this.EncodeCustomId(params))`.
- [ ] Replace `this.ParseParams(interaction.customId)` in `Run` with
      `this.DecodeCustomId(interaction.customId)` — same `Record<string, string> | null`
      shape as before.
- [ ] `CreateBuilder` now receives `params` as an argument — you can use it for more than
      just the customId now (label, style, options, etc.), which wasn't possible before.
- [ ] If you had a `UserSelectMenu` subclass declaring `abstract builder: UserSelectMenuBuilder`,
      remove it — that was dead code from an earlier version and no longer applies.

## Other fixes in this change (no migration needed)

- Fixed a bug where `SlashCommand`/interaction subclasses loaded via
  `commandFolders`/`buttonFolders`/etc. could fail at runtime — the folder loader used
  CommonJS `require()` inside an ESM project; it now uses `await import()`.
- Removed a dead `ButtonStyle.Link` check in `DiscordButton.ValidateCustomId` — Discord
  never sends an `interactionCreate` event for Link-style buttons, so it could never fire.

## New: replying is safe by default — no opt-in needed

`Run()` implementations calling `interaction.reply(...)` directly used to be one bug away
from crashing: call it twice (e.g. once in `Run`, once in error handling) and Discord rejects
the second call. That's now fixed transparently — `interaction.reply()`, `.followUp()`,
`.editReply()`, and `.deferReply()` all just work correctly no matter which one you call or
in what order, with **no code changes required**:

```ts
protected async Run(interaction: ButtonInteraction) {
    await interaction.reply({ content: "Done!" }); // just works, same as always
}
```

Under the hood, `Execute()` redirects those four methods (on that specific interaction
instance only) through a shared safe-reply state machine before calling your `Run()`:

- If nothing has responded yet, `reply()`/`followUp()`/`editReply()` all reply fresh.
- If something already replied, they follow up instead of throwing.
- If your `Run()` takes longer than ~2s, a loading embed is shown automatically before
  Discord's 3s ack deadline expires — whatever you call next **edits** that loading message
  instead of sending a second one.
- None of the four ever throw: if the underlying call fails, it retries once via `followUp`
  and only logs if that also fails.

**Trade-off:** the patched methods always resolve to `void`, not the `Message` /
`InteractionCallbackResponse` the real ones can return. If you need the sent message back
(e.g. to react to it), call `interaction.fetchReply()` afterward instead of using the return
value of `reply()`/`editReply()`.

If you want to call this logic directly instead of through `interaction.reply(...)`, it's
also available as `this.SafeReply(interaction, options, forceEphemeral?)` — same behavior,
just explicit. Set `protected readonly ephemeral = true;` on a class to make its replies
(including the auto-loading one) ephemeral by default, or pass `forceEphemeral` to override
per-call — this only takes effect on the *first* response, since Discord fixes a reply's
visibility at that point and no later edit can change it.

**Migration:** replace direct `interaction.reply(...)` / `interaction.followUp(...)` calls
in your `Run()` methods with `this.SafeReply(...)`. Not required — raw calls still work —
but you lose the double-reply protection and auto-loading behavior if you skip it.

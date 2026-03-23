import { BaseSelectMenuBuilder, ButtonBuilder, ModalBuilder } from "discord.js";

type BuilderWithCustomId = ButtonBuilder | BaseSelectMenuBuilder<any> | ModalBuilder;

export type { BuilderWithCustomId };
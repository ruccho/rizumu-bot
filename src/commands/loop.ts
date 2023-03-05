import { SlashCommandSubcommandBuilder, ChatInputCommandInteraction, CacheType, EmbedBuilder, Colors, VoiceBasedChannel, GuildMember, CommandInteraction, Guild, AttachmentBuilder } from "discord.js";
import { GuildState } from "../State";
import { followUpError, getErrorEmbed, RizumuCommand } from "../CommandManager";

import config from '../Config';
import { entersState, getVoiceConnection, joinVoiceChannel, VoiceConnection, VoiceConnectionStatus } from "@discordjs/voice";
import Rizumu from "../Rizumu";
import YtWatchProvider from "../providers/yt/YtWatchProvider";

const silentMode = config.rizumu_silent;
const headlessMode = config.rizumu_headless;

export default class LoopCommand implements RizumuCommand {
    setCommand(builder: SlashCommandSubcommandBuilder): void {
        builder
            .setName('loop')
            .setDescription('現在の曲をループ再生します。')
    }
    async execute(interaction: ChatInputCommandInteraction<CacheType>, guildState: GuildState, guild: Guild): Promise<void> {

        let em;

        if (!guildState.runtime.rizumu) {
            await interaction.reply({ embeds: [getErrorEmbed('なにも再生していません。')] });
            return;
        }

        const rizumu = guildState.runtime.rizumu;

        rizumu.setLoopSingle(!rizumu.getLoopSingle());

        em = new EmbedBuilder()
            .setTitle(rizumu.getLoopSingle() ? '🔂 ループが有効になりました。' : '➡ ループが無効になりました。')
            .setColor(Colors.Aqua);

        await interaction.reply({ embeds: [em] });
    }

}
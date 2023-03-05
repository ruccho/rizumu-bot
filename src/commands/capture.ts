import { SlashCommandSubcommandBuilder, ChatInputCommandInteraction, CacheType, EmbedBuilder, Colors, VoiceBasedChannel, GuildMember, CommandInteraction, Guild, AttachmentBuilder } from "discord.js";
import { GuildState } from "../State";
import { followUpError, RizumuCommand } from "../CommandManager";

import config from '../Config';
import { entersState, getVoiceConnection, joinVoiceChannel, VoiceConnection, VoiceConnectionStatus } from "@discordjs/voice";
import Rizumu from "../Rizumu";
import YtWatchProvider from "../providers/yt/YtWatchProvider";

const silentMode = config.rizumu_silent;
const headlessMode = config.rizumu_headless;

export default class CaptureCommand implements RizumuCommand {
    setCommand(builder: SlashCommandSubcommandBuilder): void {
        builder
            .setName('capture')
            .setDescription('現在のRizumuの画面を表示します。')
    }
    async execute(interaction: ChatInputCommandInteraction<CacheType>, guildState: GuildState, guild: Guild): Promise<void> {


        let em;

        if (!guildState.runtime.rizumu) {
            await followUpError(interaction, 'Rizumuが非アクティブです。');
            return;
        }
        em = new EmbedBuilder()
            .setDescription('キャプチャを作成中...')
            .setColor(Colors.Grey);
        await interaction.reply({ embeds: [em] });

        const pngBytes = await guildState.runtime.rizumu.captureAsync();

        const filename = `temp/capture_${guildState.runtime.rizumu.instanceId}.png`;
        const file = new AttachmentBuilder(pngBytes, {
            name: filename
        });

        await interaction.followUp({ files: [file] });
    }

}
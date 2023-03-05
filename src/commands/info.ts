import { SlashCommandSubcommandBuilder, ChatInputCommandInteraction, CacheType, EmbedBuilder, Colors, VoiceBasedChannel, GuildMember, CommandInteraction, Guild, AttachmentBuilder } from "discord.js";
import { GuildState } from "../State";
import { followUpError, getErrorEmbed, RizumuCommand } from "../CommandManager";

import config from '../Config';
import { entersState, getVoiceConnection, joinVoiceChannel, VoiceConnection, VoiceConnectionStatus } from "@discordjs/voice";
import Rizumu from "../Rizumu";
import YtWatchProvider from "../providers/yt/YtWatchProvider";

const silentMode = config.rizumu_silent;
const headlessMode = config.rizumu_headless;

export default class InfoCommand implements RizumuCommand {
    setCommand(builder: SlashCommandSubcommandBuilder): void {
        builder
            .setName('info')
            .setDescription('再生中の曲の情報を表示します。')
    }
    async execute(interaction: ChatInputCommandInteraction<CacheType>, guildState: GuildState, guild: Guild): Promise<void> {

        let em;

        if (!guildState.runtime.rizumu) {
            await interaction.reply({ embeds: [getErrorEmbed('なにも再生していません。')] });
            return;
        }

        const playingItem = guildState.runtime.rizumu.getPlayingItem();

        if (!playingItem) {
            await interaction.reply({ embeds: [getErrorEmbed('なにも再生していません。')] });
            return;
        }

        em = new EmbedBuilder()
            .setAuthor({ name: '🎧 Now Playing' })
            .setTitle(playingItem.title)
            .setFooter({ text: playingItem.author })
            .setURL(playingItem.url)
            .setColor(Colors.Grey);
        await interaction.reply({ embeds: [em] });
    }

}
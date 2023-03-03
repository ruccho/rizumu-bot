import { SlashCommandSubcommandBuilder, ChatInputCommandInteraction, CacheType, EmbedBuilder, Colors, VoiceBasedChannel, GuildMember, CommandInteraction, Guild, AttachmentBuilder } from "discord.js";
import { GuildState } from "../State";
import { followUpError, getErrorEmbed, RizumuCommand } from "../CommandManager";

import config from '../Config';
import { entersState, getVoiceConnection, joinVoiceChannel, VoiceConnection, VoiceConnectionStatus } from "@discordjs/voice";
import Rizumu from "../Rizumu";
import YtWatchProvider from "../providers/yt/YtWatchProvider";

const silentMode = config.rizumu_silent;
const headlessMode = config.rizumu_headless;

export default class ClearCommand implements RizumuCommand {
    setCommand(builder: SlashCommandSubcommandBuilder): void {
        builder
        .setName('clear')
        .setDescription('再生キューをクリアします。')
    }
    async execute(interaction: ChatInputCommandInteraction<CacheType>, guildState: GuildState, guild: Guild): Promise<void> {
        let em;

        if (!guildState.runtime.rizumu || !guildState.runtime.rizumu.isAlive()) {
            await interaction.reply({ embeds: [getErrorEmbed('なにも再生していません。')] });
            return;
        }

        const queue = guildState.runtime.rizumu.getQueue();
        queue.splice(0);

        em = new EmbedBuilder()
            .setTitle('キューを空にしました。')
            .setColor(Colors.Aqua);

        await interaction.reply({ embeds: [em] });
    }

}
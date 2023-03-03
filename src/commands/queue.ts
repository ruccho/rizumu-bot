import { SlashCommandSubcommandBuilder, ChatInputCommandInteraction, CacheType, EmbedBuilder, Colors, VoiceBasedChannel, GuildMember, CommandInteraction, Guild, AttachmentBuilder } from "discord.js";
import { GuildState } from "../State";
import { followUpError, getErrorEmbed, RizumuCommand } from "../CommandManager";

import config from '../Config';
import { entersState, getVoiceConnection, joinVoiceChannel, VoiceConnection, VoiceConnectionStatus } from "@discordjs/voice";
import Rizumu from "../Rizumu";
import YtWatchProvider from "../providers/yt/YtWatchProvider";

const silentMode = config.rizumu_silent;
const headlessMode = config.rizumu_headless;

export default class QueueCommand implements RizumuCommand {
    setCommand(builder: SlashCommandSubcommandBuilder): void {
        builder
        .setName('queue')
        .setDescription('現在の再生キューを表示します。')
    }
    async execute(interaction: ChatInputCommandInteraction<CacheType>, guildState: GuildState, guild: Guild): Promise<void> {
        let em;

        if (!guildState.runtime.rizumu || !guildState.runtime.rizumu.isAlive()) {
            await interaction.reply({ embeds: [getErrorEmbed('なにも再生していません。')] });
            return;
        }

        const queue = guildState.runtime.rizumu.getQueue();
        if (queue.length == 0) {
            await interaction.reply({ embeds: [getErrorEmbed('キューは空です。')] });
            return;
        }

        const count = Math.min(queue.length, 10);
        em = new EmbedBuilder()
            .setTitle('Next up: ')
            .setColor(Colors.Grey);

        for (let i = 0; i < count; i++) {
            const item = queue[i];
            em.addFields({name: `#${i}`, value: item.title});
        }

        await interaction.reply({ embeds: [em] });
    }

}
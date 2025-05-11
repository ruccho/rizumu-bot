import { SlashCommandSubcommandBuilder, ChatInputCommandInteraction, CacheType, EmbedBuilder, Colors } from "discord.js";
import { GuildState } from "../State";
import { getErrorEmbed, RizumuCommand } from "../CommandManager";

const command: RizumuCommand = {
    setCommand(builder: SlashCommandSubcommandBuilder): void {
        builder
            .setName('shuffle')
            .setDescription('Shuffles current queue.')
    },
    async execute(interaction: ChatInputCommandInteraction<CacheType>, guildState: GuildState): Promise<void> {

        if (!guildState.runtime.rizumu) {
            await interaction.reply({ embeds: [getErrorEmbed('Rizumu is playing nothing.')] });
            return;
        }

        const queue = guildState.runtime.rizumu.getQueue();

        for (let i = queue.length - 1; i >= 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [queue[i], queue[j]] = [queue[j], queue[i]];
        }

        const em = new EmbedBuilder()
            .setTitle('Queue shuffled.')
            .setColor(Colors.Aqua);

        await interaction.reply({ embeds: [em] });
    }

}

export default command;
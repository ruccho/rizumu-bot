import { SlashCommandSubcommandBuilder, ChatInputCommandInteraction, CacheType, EmbedBuilder, Colors } from "discord.js";
import { GuildState } from "../State";
import { getErrorEmbed, RizumuCommand } from "../CommandManager";

const command: RizumuCommand = {
    setCommand(builder: SlashCommandSubcommandBuilder): void {
        builder
            .setName('queue')
            .setDescription('Prints current items in the queue.')
    },
    async execute(interaction: ChatInputCommandInteraction<CacheType>, guildState: GuildState): Promise<void> {

        if (!guildState.runtime.rizumu) {
            await interaction.reply({ embeds: [getErrorEmbed('Rizumu is playing nothing')] });
            return;
        }

        const queue = guildState.runtime.rizumu.getQueue();
        if (queue.length == 0) {
            await interaction.reply({ embeds: [getErrorEmbed('Queue is empty.')] });
            return;
        }

        const count = Math.min(queue.length, 10);
        const em = new EmbedBuilder()
            .setTitle('Next up: ')
            .setColor(Colors.Grey);

        for (let i = 0; i < count; i++) {
            const item = queue[i];
            em.addFields({ name: `#${i}`, value: item.title });
        }

        await interaction.reply({ embeds: [em] });
    }

}

export default command;
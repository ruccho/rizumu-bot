import { SlashCommandSubcommandBuilder, ChatInputCommandInteraction, CacheType, EmbedBuilder, Colors } from "discord.js";
import { GuildState } from "../State";
import { getErrorEmbed, RizumuCommand } from "../CommandManager";

const command: RizumuCommand = {
    setCommand(builder: SlashCommandSubcommandBuilder): void {
        builder
            .setName('clear')
            .setDescription('Clears the queue.')
    },
    async execute(interaction: ChatInputCommandInteraction<CacheType>, guildState: GuildState): Promise<void> {

        if (!guildState.runtime.rizumu) {
            await interaction.reply({ embeds: [getErrorEmbed('Rizumu is playing nothing.')] });
            return;
        }

        const queue = guildState.runtime.rizumu.getQueue();
        queue.splice(0);

        const em = new EmbedBuilder()
            .setTitle('Queue cleared.')
            .setColor(Colors.Aqua);

        await interaction.reply({ embeds: [em] });
    }

}

export default command;
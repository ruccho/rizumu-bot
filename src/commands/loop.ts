import { SlashCommandSubcommandBuilder, ChatInputCommandInteraction, CacheType, EmbedBuilder, Colors } from "discord.js";
import { GuildState } from "../State";
import { getErrorEmbed, RizumuCommand } from "../CommandManager";

const command: RizumuCommand = {
    setCommand(builder: SlashCommandSubcommandBuilder): void {
        builder
            .setName('loop')
            .setDescription('Loops current song.')
    },
    async execute(interaction: ChatInputCommandInteraction<CacheType>, guildState: GuildState): Promise<void> {

        if (!guildState.runtime.rizumu) {
            await interaction.reply({ embeds: [getErrorEmbed('Rizumu is playing nothing.')] });
            return;
        }

        const rizumu = guildState.runtime.rizumu;

        rizumu.setLoopSingle(!rizumu.getLoopSingle());

        const em = new EmbedBuilder()
            .setTitle(rizumu.getLoopSingle() ? '🔂 Loop enabled.' : '➡ Loop disabled.')
            .setColor(Colors.Aqua);

        await interaction.reply({ embeds: [em] });
    }

}

export default command;
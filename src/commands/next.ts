import { SlashCommandSubcommandBuilder, ChatInputCommandInteraction, CacheType, EmbedBuilder, Colors } from "discord.js";
import { GuildState } from "../State";
import { RizumuCommand } from "../CommandManager";

const command: RizumuCommand = {
    setCommand(builder: SlashCommandSubcommandBuilder): void {
        builder
            .setName('next')
            .setDescription('Skips current song.')
    },
    async execute(interaction: ChatInputCommandInteraction<CacheType>, guildState: GuildState): Promise<void> {

        let em;

        if (!guildState.runtime.rizumu) {
            em = new EmbedBuilder()
                .setDescription(`Rizumu is playing nothing.`)
                .setColor(Colors.Grey);
            await interaction.reply({ embeds: [em] });
            return;
        }

        em = new EmbedBuilder()
            .setDescription(`⏭ Loading...`)
            .setColor(Colors.Grey);
        await interaction.reply({ embeds: [em] });
        await guildState.runtime.rizumu.moveQueueAsync(0);
        em = new EmbedBuilder()
            .setDescription(`⏭`)
            .setColor(Colors.Aqua);
        await interaction.editReply({ embeds: [em] });
    }

}

export default command;
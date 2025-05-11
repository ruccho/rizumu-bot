import { SlashCommandSubcommandBuilder, ChatInputCommandInteraction, CacheType, EmbedBuilder, Colors } from "discord.js";
import { GuildState } from "../State";
import { getErrorEmbed, RizumuCommand } from "../CommandManager";

const command: RizumuCommand = {
    setCommand(builder: SlashCommandSubcommandBuilder): void {
        builder
            .setName('info')
            .setDescription('Prints current song information.')
    },
    async execute(interaction: ChatInputCommandInteraction<CacheType>, guildState: GuildState): Promise<void> {

        if (!guildState.runtime.rizumu) {
            await interaction.reply({ embeds: [getErrorEmbed('Rizumu is playing nothing.')] });
            return;
        }

        const playingItem = guildState.runtime.rizumu.getPlayingItem();

        if (!playingItem) {
            await interaction.reply({ embeds: [getErrorEmbed('Rizumu is playing nothing.')] });
            return;
        }

        const em = new EmbedBuilder()
            .setAuthor({ name: '🎧 Now Playing' })
            .setTitle(playingItem.title)
            .setFooter({ text: playingItem.author })
            .setURL(playingItem.url)
            .setColor(Colors.Grey);
        await interaction.reply({ embeds: [em] });
    }

}

export default command;
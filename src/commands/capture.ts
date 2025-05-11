import { SlashCommandSubcommandBuilder, ChatInputCommandInteraction, CacheType, EmbedBuilder, Colors, AttachmentBuilder } from "discord.js";
import { GuildState } from "../State";
import { followUpError, RizumuCommand } from "../CommandManager";

const command: RizumuCommand = {
    setCommand(builder: SlashCommandSubcommandBuilder): void {
        builder
            .setName('capture')
            .setDescription('Shows current screenshot of Rizumu.')
    },
    async execute(interaction: ChatInputCommandInteraction<CacheType>, guildState: GuildState): Promise<void> {

        if (!guildState.runtime.rizumu) {
            await followUpError(interaction, 'Rizumu is inactive.');
            return;
        }
        const em = new EmbedBuilder()
            .setDescription('Taking a screenshot...')
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
export default command;
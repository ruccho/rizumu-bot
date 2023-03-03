import { ChatInputCommandInteraction, Colors, CommandInteraction, EmbedBuilder, Guild, Interaction, REST, Routes, SlashCommandBuilder, SlashCommandSubcommandBuilder } from "discord.js";
import config from "./Config";
import state, { GuildState } from "./State";

const { rizumu_command_prefix, discord_token, discord_client_id } = config;

const rest = new REST({ version: '9' }).setToken(discord_token);
const clientId = discord_client_id;

export interface RizumuCommand {
    setCommand(builder: SlashCommandSubcommandBuilder): void;
    execute(interaction: ChatInputCommandInteraction, guildState: GuildState, guild: Guild): Promise<void>
}

function getGuildState(guildId: string) {
    return state.guilds[guildId];
}


export function getErrorEmbed(message: string) {
    return new EmbedBuilder()
        .setTitle('❌ エラー')
        .setDescription(message)
        .setColor(Colors.Red);
}

export async function followUpError(interaction: CommandInteraction, message: string) {
    await interaction.followUp({ embeds: [getErrorEmbed(message)] });
}

export class CommandManager {
    private builder: SlashCommandBuilder;
    private commands: Record<string, RizumuCommand | undefined>;
    constructor(...commands: RizumuCommand[]) {

        this.builder = new SlashCommandBuilder()
            .setName(rizumu_command_prefix)
            .setDescription('Rizumu botをコントロールします。');

        this.commands = {};

        for (const command of commands) {
            this.builder.addSubcommand(c => {
                command.setCommand(c);
                if (c.name !== "") {
                    this.commands[c.name] = command;
                }
                return c;
            })
        }
    }

    async register() {
        await rest.put(
            Routes.applicationCommands(clientId),
            { body: [this.builder.toJSON()] },
        );
    }

    async process(interaction: Interaction): Promise<void> {
        if (!interaction.isChatInputCommand()) return;

        const { commandName } = interaction;

        if (commandName !== rizumu_command_prefix) return;

        const subcommand = interaction.options.getSubcommand();

        const command = this.commands[subcommand];

        if (!command) return;

        const guild = interaction.guild;
        if (!guild) return;
        const guildId = guild.id;
        const guildState = getGuildState(guildId);
        if (!guildState) {

            const em = new EmbedBuilder()
                .setTitle('❌ エラー')
                .setDescription('このサーバーでは現在Rizumuを使用できません。')
                .setColor(Colors.Red);
            await interaction.reply({ embeds: [em] });

            return;
        }

        await command.execute(interaction, guildState, guild);
    }
} 
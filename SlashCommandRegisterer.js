const { SlashCommandBuilder } = require('@discordjs/builders');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const { discord_token, discord_client_id } = require('./config.json');

const commands = [
    new SlashCommandBuilder()
        .setName('rizumu')
        .setDescription('Rizumu botをコントロールします。')
        .addSubcommand(c => c
            .setName('play')
            .setDescription('動画またはプレイリストを再生します。')
            .addStringOption(option => option.setName('url').setDescription('再生するYouTube URL').setRequired(true))
        )
        .addSubcommand(c => c
            .setName('leave')
            .setDescription('現在のボイスチャンネルを退出します。')
        )
        .addSubcommand(c => c
            .setName('prev')
            .setDescription('前の曲に戻ります。')
        )
        .addSubcommand(c => c
            .setName('again')
            .setDescription('現在の曲を再度再生します。')
        )
        .addSubcommand(c => c
            .setName('next')
            .setDescription('次の曲へ移ります。')
        )
].map(command => command.toJSON());

const rest = new REST({ version: '9' }).setToken(discord_token);
const clientId = discord_client_id;

class SlashCommandRegisterer {

    getVersion() {
        return 1;
    }

    async register(guildId) {
        try {
            await rest.put(
                Routes.applicationGuildCommands(clientId, guildId),
                { body: commands },
            );

            console.log('[MAIN] Successfully registered application commands.');
        } catch (error) {
            console.error('[MAIN] ' + error);
        }
    }

}

module.exports = new SlashCommandRegisterer();
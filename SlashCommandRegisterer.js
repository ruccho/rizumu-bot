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
            .setDescription('動画またはプレイリストをキューに追加して再生します。')
            .addStringOption(option => option.setName('url').setDescription('再生するYouTube URL').setRequired(true))
        )
        .addSubcommand(c => c
            .setName('leave')
            .setDescription('現在のボイスチャンネルを退出します。')
        )
        .addSubcommand(c => c
            .setName('next')
            .setDescription('次の曲へ移ります。')
        )
        .addSubcommand(c => c
            .setName('capture')
            .setDescription('現在のRizumuの画面を表示します。')
        )/*
        .addSubcommand(c => c
            .setName('queue')
            .setDescription('現在の再生キューを表示します。')
        )
        .addSubcommand(c => c
            .setName('clear')
            .setDescription('再生キューをクリアします。')
        )
        .addSubcommand(c => c
            .setName('info')
            .setDescription('再生中の曲の情報を表示します。')
        )*/
].map(command => command.toJSON());

const rest = new REST({ version: '9' }).setToken(discord_token);
const clientId = discord_client_id;

class SlashCommandRegisterer {

    async register() {
        try {
            await rest.put(
                Routes.applicationCommands(clientId),
                { body: commands },
            );

            console.log('[MAIN] Successfully registered application commands.');
        } catch (error) {
            console.error('[MAIN] ' + error);
        }
    }
}

module.exports = new SlashCommandRegisterer();
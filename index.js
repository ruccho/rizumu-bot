const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path');
const { Stream, Readable } = require('stream');
const uuid = require('uuid')
const { Client, Intents, MessageEmbed, MessageAttachment } = require('discord.js');
const {
    VoiceConnectionStatus,
    AudioPlayerStatus,
    joinVoiceChannel,
    getVoiceConnection,
    createAudioPlayer,
    NoSubscriberBehavior,
    createAudioResource,
    StreamType,
    entersState
} = require('@discordjs/voice');

const { discord_token } = require('./config.json');
const Rizumu = require('./Rizumu');
const state = require('./state.json');
const commandRegisterer = require('./SlashCommandRegisterer')

//app.disableHardwareAcceleration();

dialog.showErrorBox = function (title, content) {
    console.log(`[MAIN] Electron error: ${title}: ${content}`);
    process.exit(-1);
};

const client = new Client({ intents: [Intents.FLAGS.GUILDS, 'GUILD_VOICE_STATES'] });

async function intiializeElectron() {
    await app.whenReady();

    const killBlock = new BrowserWindow({
        show: false
    });
    killBlock.loadFile('public/killblock.html');
}

intiializeElectron();

client.once('ready', () => {
    console.log('[MAIN] Discord client ready!');
    commandRegisterer.register();
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    const { commandName } = interaction;

    if (commandName === 'rizumu') {
        const subcommand = interaction.options.getSubcommand();
        if (subcommand === 'leave') {
            const guild = interaction.guild;
            const guildId = guild.id;
            const guildState = getGuildState(guildId);

            const connection = getVoiceConnection(guild.id);
            if (connection) connection.destroy();

            if (guildState._rizumu) {
                guildState._rizumu.close();
                guildState._player = null;
            }

            let em = new MessageEmbed()
                .setDescription('退出しました。')
                .setColor('GREY');

            await interaction.reply({ embeds: [em] });

        } else if (subcommand === 'play') {

            const urlStr = interaction.options.getString('url');
            console.log(urlStr);
            const url = new URL(urlStr);

            let em;
            em = new MessageEmbed()
                .setDescription('▶ 接続中...')
                .setColor('GREY');
            await interaction.reply({ embeds: [em] });

            const guild = interaction.guild;
            const guildId = guild.id;
            const guildState = getGuildState(guildId);
            if (!guildState) {
                em = new MessageEmbed()
                    .setTitle('❌ エラー')
                    .setDescription('このサーバーでは現在Rizumuを使用できません。')
                    .setColor('RED');
                await interaction.followUp({ embeds: [em] });
                return;
            }

            //join voiceChannel
            const voiceChannel = interaction.member.voice.channel;
            if (!voiceChannel) {
                em = new MessageEmbed()
                    .setTitle('❌ エラー')
                    .setDescription('ボイスチャンネルに参加してから使用してください。')
                    .setColor('RED');
                await interaction.followUp({ embeds: [em] });
                return;
            }
            console.log("[MAIN] VoiceChannel: " + voiceChannel.id);

            let connection = getVoiceConnection(guild.id);

            if (!connection) {
                console.log("[MAIN] Join to channel");
                connection = joinVoiceChannel({
                    channelId: voiceChannel.id,
                    guildId: guildId,
                    adapterCreator: guild.voiceAdapterCreator,
                });

                connection.on(VoiceConnectionStatus.Connecting, () => {
                    console.log('[MAIN] VoiceConnection connecting');
                });
                connection.on(VoiceConnectionStatus.Ready, () => {
                    console.log('[MAIN] VoiceConnection ready!');
                });
                connection.on(VoiceConnectionStatus.Disconnected, () => {
                    console.log('[MAIN] VoiceConnection disconnected');
                });
                connection.on(VoiceConnectionStatus.Destroyed, () => {
                    console.log('[MAIN] VoiceConnection destroyed');
                });

                console.log("connecting...")
                try {
                    await entersState(connection, VoiceConnectionStatus.Ready, 30_000);
                    console.log("[MAIN] Connected")
                } catch (error) {
                    connection.destroy();
                    throw error;
                }

            } else {
                console.log("[MAIN] Existing VoiceConnection obtained!");
            }

            if (!guildState._rizumu || !guildState._rizumu.isAlive()) {

                em = new MessageEmbed()
                    .setDescription('▶ Rizumuを起動中...')
                    .setColor('GREY');
                await interaction.editReply({ embeds: [em] });

                console.log('[MAIN] Creating Rizumu instance...');
                guildState._rizumu = new Rizumu();
            }
            
            connection.subscribe(guildState._rizumu.getAudioPlayer());

            try {
                await guildState._rizumu.readyAsync();

                await guildState._rizumu.playUrlAsync(url, async progress => {
                    em = new MessageEmbed()
                        .setDescription(`▶ ${progress.message}`)
                        .setColor('GREY');
                    await interaction.editReply({ embeds: [em] });
                });
            } catch (error) {
                em = new MessageEmbed()
                    .setTitle('❌ エラー')
                    .setDescription('失敗しました。')
                    .setColor('RED');
                await interaction.followUp({ embeds: [em] });
                throw error;
            }
            em = new MessageEmbed()
                .setTitle('▶ 完了')
                .setDescription('アイテムがキューに追加されました。')
                .addField('追加されたアイテム', urlStr)
                .setColor('AQUA');
            await interaction.editReply({ embeds: [em] });


        } else if (subcommand === 'next') {
            const guild = interaction.guild;
            const guildId = guild.id;
            const guildState = getGuildState(guildId);
            let em;
            if (!guildState) {
                em = new MessageEmbed()
                    .setTitle('❌ エラー')
                    .setDescription('このサーバーでは現在Rizumuを使用できません。')
                    .setColor('RED');
                await interaction.reply({ embeds: [em] });
                return;
            }

            if (!guildState._rizumu || !guildState._rizumu.isAlive()) {
                em = new MessageEmbed()
                    .setDescription(`なにも再生していません。`)
                    .setColor('GREY');
                await interaction.reply({ embeds: [em] });
                return;
            }

            em = new MessageEmbed()
                .setDescription(`⏭ Loading...`)
                .setColor('GREY');
            await interaction.reply({ embeds: [em] });
            await guildState._rizumu.moveQueueAsync(0);
            em = new MessageEmbed()
                .setDescription(`⏭`)
                .setColor('AQUA');
            await interaction.editReply({ embeds: [em] });
        } else if (subcommand === 'capture') {
            const guild = interaction.guild;
            const guildId = guild.id;
            const guildState = getGuildState(guildId);
            let em;
            if (!guildState) {
                em = new MessageEmbed()
                    .setTitle('❌ エラー')
                    .setDescription('このサーバーでは現在Rizumuを使用できません。')
                    .setColor('RED');
                await interaction.reply({ embeds: [em] });
                return;
            }


            if (!guildState._rizumu || !guildState._rizumu.isAlive()) {
                em = new MessageEmbed()
                    .setTitle('❌ エラー')
                    .setDescription('Rizumuが非アクティブです。')
                    .setColor('RED');
                await interaction.reply({ embeds: [em] });
                return;
            }
            em = new MessageEmbed()
                .setDescription('キャプチャを作成中...')
                .setColor('GREY');
            await interaction.reply({ embeds: [em] });

            const pngBytes = await guildState._rizumu.captureAsync();

            const filename = `temp/capture_${guildState._rizumu._instanceId}.png`;
            const file = new MessageAttachment(pngBytes, filename);

            await interaction.followUp({ files: [file] });
        }
    }
});

client.on('voiceStateUpdate', (oldState, newState) => {
    //leaves

    if (oldState.channel && oldState.channelId !== newState.channelId) {
        console.log(`[MAIN] A guild member has been moved from ${oldState.channelId} to ${newState.channelId}`);

        let realMemberCount = 0;
        for (let member of oldState.channel.members) {
            if (!member[1].user.bot) realMemberCount++;
        }

        console.log(`[MAIN] ${realMemberCount} real members`);

        if (realMemberCount > 0) return;

        const guild = newState.guild;
        const guildId = guild.id;
        const guildState = getGuildState(guildId);
        if (!guildState) return;

        const connection = getVoiceConnection(guild.id);
        if (connection) {
            const channelId = connection.joinConfig.channelId;
            if (oldState.channelId === channelId) {
                connection.destroy();

                if (guildState._rizumu) {
                    guildState._rizumu.close();
                    guildState._rizumu = null;
                    guildState._player = null;
                }

            }
        }
    }
});

(async () => {
    try {
        await client.login(discord_token);
    } catch (error) {
        console.log(error);
        process.exit(-1);
    }
})();

function getGuildState(guildId) {
    let entry = state.guilds[guildId];
    return entry;
}


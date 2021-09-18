const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path');
const { Stream, Readable } = require('stream');
const uuid = require('uuid')
const { Client, Intents } = require('discord.js');
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
    client.guilds.cache.each(guild => {
        initializeForGuild(guild);
    });
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

            await interaction.reply("退出しました。");

        } else if (subcommand === 'play') {

            const urlStr = interaction.options.getString('url');
            console.log(urlStr);
            const url = new URL(urlStr);

            await interaction.reply(`▶ Loading... `);

            const guild = interaction.guild;
            const guildId = guild.id;
            const guildState = getGuildState(guildId);
            if (!guildState) return;

            //join voiceChannel
            const voiceChannel = interaction.member.voice.channel;
            if (!voiceChannel) {
                await interaction.editReply(`ボイスチャンネルを取得できませんでした。`);
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
                console.log('[MAIN] Creating Rizumu instance...');
                guildState._rizumu = new Rizumu();
                guildState._player = createAudioPlayer({
                    behaviors: {
                        noSubscriber: NoSubscriberBehavior.Play,
                        maxMissedFrames: 5000 / 20
                    }
                });

                const rawStream = guildState._rizumu.getAudioStream();

                guildState._audioResouce = createAudioResource(rawStream, {
                    inputType: StreamType.Raw,
                    inlineVolume: true
                });
                guildState._audioResouce.volume.setVolume(0.2);

                guildState._player.play(guildState._audioResouce);
            }
            connection.subscribe(guildState._player);

            try {
                await guildState._rizumu.readyAsync();
                await guildState._rizumu.playUrlAsync(url, async progress => {
                    //await interaction.editReply(progress.message);
                });
            } catch (error) {
                await interaction.editReply(`失敗しました。`);
                throw error;
            }
            await interaction.followUp(`▶ ${url}`);


        } else if (subcommand === 'next') {
            const guild = interaction.guild;
            const guildId = guild.id;
            const guildState = getGuildState(guildId);
            if (!guildState) return;

            if (!guildState._rizumu || !guildState._rizumu.isAlive()) {
                await interaction.reply(`何も再生していません。`);
                return;
            }

            guildState._rizumu.playNext();
            await interaction.reply(`⏭`);
        } else if (subcommand === 'again') {
            const guild = interaction.guild;
            const guildId = guild.id;
            const guildState = getGuildState(guildId);
            if (!guildState) return;

            if (!guildState._rizumu || !guildState._rizumu.isAlive()) {
                await interaction.reply(`何も再生していません。`);
                return;
            }

            guildState._rizumu.playAgain();
            await interaction.reply(`⏮`);
        } else if (subcommand === 'prev') {
            const guild = interaction.guild;
            const guildId = guild.id;
            const guildState = getGuildState(guildId);
            if (!guildState) return;

            if (!guildState._rizumu || !guildState._rizumu.isAlive()) {
                await interaction.reply(`何も再生していません。`);
                return;
            }

            guildState._rizumu.playPrev();
            await interaction.reply(`⏮⏮`);
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

client.on('guildCreate', guild => {
    console.log("[MAIN] New Guild");
    initializeForGuild(guild);
});

(async () => {
    try {
        await client.login(discord_token);
    } catch (error) {
        console.log(error);
        process.exit(-1);
    }
})();


function initializeForGuild(guild) {
    let entry = state.guilds[guild.id];
    if (entry) {
        if (entry.commandVersion < commandRegisterer.getVersion()) {
            commandRegisterer.register(guild.id);
            console.log(`[MAIN] Command registered: ${guild.name}`);
        }
    } else {
        console.log(`[MAIN] Unregistered guild: ${guild.name}`);
    }
}

function getGuildState(guildId) {
    let entry = state.guilds[guildId];
    return entry;
}


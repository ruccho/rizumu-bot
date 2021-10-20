const { app, BrowserWindow, dialog } = require('electron')
const { Client, Intents, MessageEmbed, MessageAttachment } = require('discord.js');
const {
    VoiceConnectionStatus,
    joinVoiceChannel,
    getVoiceConnection,
    entersState
} = require('@discordjs/voice');

const config = require('./config.json');
const Rizumu = require('./Rizumu');
const state = require('./state.json');
const commandRegisterer = require('./SlashCommandRegisterer')

const { discord_token, rizumu_command_prefix } = config;
const silentMode = config.rizumu_silent;
const headlessMode = config.rizumu_headless;

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

    if (commandName === rizumu_command_prefix) {
        const subcommand = interaction.options.getSubcommand();
        if (subcommand === 'leave') {
            const guild = interaction.guild;
            const guildId = guild.id;
            const guildState = getGuildState(guildId);

            if (!silentMode) {
                const connection = getVoiceConnection(guild.id);
                if (connection) connection.destroy();
            }

            if (guildState._rizumu) {
                guildState._rizumu.close();
                guildState._player = null;
            }

            let em = new MessageEmbed()
                .setDescription('退出しました。')
                .setColor('GREY');

            await interaction.reply({ embeds: [em] });

        } else if (subcommand === 'play') {

            const guild = interaction.guild;
            const guildId = guild.id;
            const guildState = await validateGuildState(interaction);
            if (!guildState) return;

            const urlStr = interaction.options.getString('url');
            console.log(urlStr);
            const url = new URL(urlStr);

            let em;
            em = new MessageEmbed()
                .setDescription('▶ 接続中...')
                .setColor('GREY');
            await interaction.reply({ embeds: [em] });

            let voiceChannel;
            if (!silentMode) {
                //join voiceChannel
                voiceChannel = interaction.member.voice.channel;
                if (!voiceChannel) {
                    await followUpError(interaction, 'ボイスチャンネルに参加してから使用してください。');
                    return;
                }
                console.log("[MAIN] VoiceChannel: " + voiceChannel.id);
            }

            let connection;
            if (!silentMode) {
                connection = getVoiceConnection(guild.id);

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
            }

            if (!guildState._rizumu || !guildState._rizumu.isAlive()) {

                em = new MessageEmbed()
                    .setDescription('▶ Rizumuを起動中...')
                    .setColor('GREY');
                await interaction.editReply({ embeds: [em] });

                console.log('[MAIN] Creating Rizumu instance...');
                guildState._rizumu = new Rizumu(headlessMode);
            }

            if (!silentMode) {
                connection.subscribe(guildState._rizumu.getAudioPlayer());
            }

            try {
                await guildState._rizumu.readyAsync();

                await guildState._rizumu.playUrlAsync(url, async progress => {
                    em = new MessageEmbed()
                        .setDescription(`▶ ${progress.message}`)
                        .setColor('GREY');
                    await interaction.editReply({ embeds: [em] });
                });
            } catch (error) {
                await followUpError(interaction, '失敗しました。');
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
            const guildState = await validateGuildState(interaction);
            if (!guildState) return;

            let em;

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
            const guildState = await validateGuildState(interaction);
            if (!guildState) return;

            let em;

            if (!guildState._rizumu || !guildState._rizumu.isAlive()) {
                await followUpError(interaction, 'Rizumuが非アクティブです。');
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
        } else if (subcommand === 'info') {

            const guild = interaction.guild;
            const guildId = guild.id;
            const guildState = await validateGuildState(interaction);
            if (!guildState) return;

            let em;

            if (!guildState._rizumu || !guildState._rizumu.isAlive()) {
                await interaction.reply({ embeds: [getErrorEmbed('なにも再生していません。')] });
                return;
            }

            const playingItem = guildState._rizumu.getPlayingItem();

            if (!playingItem) {
                await interaction.reply({ embeds: [getErrorEmbed('なにも再生していません。')] });
                return;
            }

            em = new MessageEmbed()
                .setAuthor('🎧 Now Playing')
                .setTitle(playingItem.title)
                .setFooter(playingItem.channel)
                .setURL(playingItem.getUrl())
                .setColor('GREY');
            await interaction.reply({ embeds: [em] });
        } else if (subcommand === 'queue') {

            const guild = interaction.guild;
            const guildId = guild.id;
            const guildState = await validateGuildState(interaction);
            if (!guildState) return;

            let em;

            if (!guildState._rizumu || !guildState._rizumu.isAlive()) {
                await interaction.reply({ embeds: [getErrorEmbed('なにも再生していません。')] });
                return;
            }

            const queue = guildState._rizumu.getQueue();
            if(queue.length == 0)
            {
                await interaction.reply({ embeds: [getErrorEmbed('キューは空です。')] });
                return;
            }

            const count = Math.min(queue.length, 10);
            em = new MessageEmbed()
                .setTitle('Next up: ')
                .setColor('GREY');

            for (let i = 0; i < count; i++) {
                const item = queue[i];
                em.addField(`#${i}`, item.toString());
            }

            await interaction.reply({ embeds: [em] });
        }else if (subcommand === 'clear') {

            const guild = interaction.guild;
            const guildId = guild.id;
            const guildState = await validateGuildState(interaction);
            if (!guildState) return;

            let em;

            if (!guildState._rizumu || !guildState._rizumu.isAlive()) {
                await interaction.reply({ embeds: [getErrorEmbed('なにも再生していません。')] });
                return;
            }

            const queue = guildState._rizumu.getQueue();
            queue.splice(0);
            
            em = new MessageEmbed()
                .setTitle('キューを空にしました。')
                .setColor('AQUA');

            await interaction.reply({ embeds: [em] });
        } else if(subcommand === 'shuffle'){

            const guild = interaction.guild;
            const guildId = guild.id;
            const guildState = await validateGuildState(interaction);
            if (!guildState) return;

            let em;

            if (!guildState._rizumu || !guildState._rizumu.isAlive()) {
                await interaction.reply({ embeds: [getErrorEmbed('なにも再生していません。')] });
                return;
            }

            const queue = guildState._rizumu.getQueue();

            for (let i = queue.length - 1; i >= 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [queue[i], queue[j]] = [queue[j], queue[i]];
              }
            
            em = new MessageEmbed()
                .setTitle('キューをシャッフルしました。')
                .setColor('AQUA');

            await interaction.reply({ embeds: [em] });
        }else if(subcommand === 'loop'){

            const guild = interaction.guild;
            const guildId = guild.id;
            const guildState = await validateGuildState(interaction);
            if (!guildState) return;

            let em;

            if (!guildState._rizumu || !guildState._rizumu.isAlive()) {
                await interaction.reply({ embeds: [getErrorEmbed('なにも再生していません。')] });
                return;
            }

            const rizumu = guildState._rizumu;

            rizumu.setLoopSingle(!rizumu.getLoopSingle());

            em = new MessageEmbed()
                .setTitle(rizumu.getLoopSingle() ? '🔂 ループが有効になりました。' : '➡ ループが無効になりました。')
                .setColor('AQUA');

            await interaction.reply({ embeds: [em] });
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

async function validateGuildState(interaction) {
    const guild = interaction.guild;
    const guildId = guild.id;
    const guildState = getGuildState(guildId);

    if (!guildState) {
        const em = new MessageEmbed()
            .setTitle('❌ エラー')
            .setDescription('このサーバーでは現在Rizumuを使用できません。')
            .setColor('RED');
        await interaction.reply({ embeds: [em] });
        return false;
    }

    return guildState;
}

function getErrorEmbed(message) {
    return new MessageEmbed()
        .setTitle('❌ エラー')
        .setDescription(message)
        .setColor('RED');
}

async function followUpError(interaction, message) {
    await interaction.followUp({ embeds: [getErrorEmbed(message)] });
}
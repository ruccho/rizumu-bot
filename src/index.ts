import { app, BrowserWindow, dialog } from 'electron';
import { Client, CommandInteraction, Events, GatewayIntentBits, EmbedBuilder, Colors } from 'discord.js';

import config from './Config';
import Rizumu from './Rizumu';
import state from "./State";
import { CommandManager, getGuildState } from './CommandManager';
import CaptureCommand from './commands/capture';
import ClearCommand from './commands/clear';
import InfoCommand from './commands/info';
import LeaveCommand from './commands/leave';
import LoopCommand from './commands/loop';
import NextCommand from './commands/next';
import PlayCommand from './commands/play';
import QueueCommand from './commands/queue';
import ShuffleCommand from './commands/shuffle';
import { getVoiceConnection } from '@discordjs/voice';

const { discord_token } = config;

//app.disableHardwareAcceleration();

dialog.showErrorBox = function (title, content) {
    console.log(`[MAIN] Electron error: ${title}: ${content}`);
    process.exit(-1);
};

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates] });

async function intiializeElectron() {
    await app.whenReady();

    const killBlock = new BrowserWindow({
        show: false
    });
    killBlock.loadFile('../public/killblock.html');
}

intiializeElectron();

client.once('ready', async () => {
    console.log('[MAIN] Discord client ready!');
    console.log("[MAIN] Command registeration...");
    await commandManager.register();
    console.log("[MAIN] Command registration succeeded");
});

const commandManager = new CommandManager(
    new CaptureCommand(),
    new ClearCommand(),
    new InfoCommand(),
    new LeaveCommand(),
    new LoopCommand(),
    new NextCommand(),
    new PlayCommand(),
    new QueueCommand(),
    new ShuffleCommand()
)

client.on(Events.InteractionCreate, async interaction => {

    commandManager.process(interaction);

});

client.on('voiceStateUpdate', (oldState, newState) => {
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

                if (guildState.runtime.rizumu) {
                    guildState.runtime.rizumu.close();
                    guildState.runtime.rizumu = undefined;
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
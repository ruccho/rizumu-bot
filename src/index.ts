import { app, BrowserWindow, dialog } from 'electron';
import { Client, CommandInteraction, Events, GatewayIntentBits, EmbedBuilder, Colors } from 'discord.js';

import config from './Config';
import Rizumu from './Rizumu';
import state from "./State";
import { CommandManager } from './CommandManager';
import CaptureCommand from './commands/capture';
import ClearCommand from './commands/clear';
import InfoCommand from './commands/info';
import LeaveCommand from './commands/leave';
import LoopCommand from './commands/loop';
import NextCommand from './commands/next';
import PlayCommand from './commands/play';
import QueueCommand from './commands/queue';
import ShuffleCommand from './commands/shuffle';

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

(async () => {
    try {
        await client.login(discord_token);
    } catch (error) {
        console.log(error);
        process.exit(-1);
    }
})();
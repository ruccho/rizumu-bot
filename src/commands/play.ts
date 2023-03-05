import { SlashCommandSubcommandBuilder, ChatInputCommandInteraction, CacheType, EmbedBuilder, Colors, VoiceBasedChannel, GuildMember, CommandInteraction, Guild } from "discord.js";
import { GuildState } from "../State";
import { followUpError, RizumuCommand } from "../CommandManager";

import config from '../Config';
import { entersState, getVoiceConnection, joinVoiceChannel, VoiceConnection, VoiceConnectionStatus } from "@discordjs/voice";
import Rizumu from "../Rizumu";
import YtWatchProvider from "../providers/yt/YtWatchProvider";
import { PublicError } from "../PublicError";

const silentMode = config.rizumu_silent;
const headlessMode = config.rizumu_headless;

export default class PlayCommand implements RizumuCommand {
    setCommand(builder: SlashCommandSubcommandBuilder): void {
        builder
            .setName('play')
            .setDescription('動画またはプレイリストをキューに追加して再生します。')
            .addStringOption(option => option.setName('url').setDescription('再生するURL').setRequired(true));
    }

    async execute(interaction: ChatInputCommandInteraction<CacheType>, guildState: GuildState, guild: Guild): Promise<void> {

        const urlStr = interaction.options.getString('url');
        if (!urlStr) return;

        console.log(urlStr);
        const url = new URL(urlStr);

        let em;
        em = new EmbedBuilder()
            .setDescription('▶ 接続中...')
            .setColor(Colors.Grey);
        await interaction.reply({ embeds: [em] });

        let voiceChannel: VoiceBasedChannel | undefined;
        if (!silentMode) {
            //join voiceChannel
            const channel = (interaction.member as GuildMember).voice.channel;
            if (!channel) {
                await followUpError(interaction, 'ボイスチャンネルに参加してから使用してください。');
                return;
            }
            voiceChannel = channel;
            console.log("[MAIN] VoiceChannel: " + voiceChannel.id);
        }

        let connection: VoiceConnection | undefined;
        if (!silentMode) {
            const guildId = guild.id;

            connection = getVoiceConnection(guildId);

            if (!connection) {
                console.log("[MAIN] Join to channel");
                connection = joinVoiceChannel({
                    channelId: voiceChannel!.id,
                    guildId: guildId,
                    adapterCreator: guild.voiceAdapterCreator,
                });

                //workaround for https://github.com/discordjs/discord.js/issues/9185
                connection.on('stateChange', (oldState, newState) => {
                    const oldNetworking = Reflect.get(oldState, 'networking');
                    const newNetworking = Reflect.get(newState, 'networking');

                    const networkStateChangeHandler = (oldNetworkState: any, newNetworkState: any) => {
                        const newUdp = Reflect.get(newNetworkState, 'udp');
                        clearInterval(newUdp?.keepAliveInterval);
                    }

                    oldNetworking?.off('stateChange', networkStateChangeHandler);
                    newNetworking?.on('stateChange', networkStateChangeHandler);
                });

                connection.on(VoiceConnectionStatus.Signalling, () => {
                    console.log('[MAIN] VoiceConnection signaling');
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

        if (!guildState.runtime.rizumu) {

            em = new EmbedBuilder()
                .setDescription('▶ Rizumuを起動中...')
                .setColor(Colors.Grey);
            await interaction.editReply({ embeds: [em] });

            console.log('[MAIN] Creating Rizumu instance...');
            guildState.runtime.rizumu = new Rizumu({
                headless: headlessMode,
                providers: [
                    new YtWatchProvider()
                ]
            });
        }

        const rizumu = guildState.runtime.rizumu;

        if (!silentMode) {
            connection!.subscribe(rizumu.getAudioPlayer());
        }

        try {
            //await guildState._rizumu.readyAsync();

            await rizumu.pushUrlAsync(url, async progress => {
                em = new EmbedBuilder()
                    .setDescription(`▶ ${progress.message}`)
                    .setColor(Colors.Grey);
                await interaction.editReply({ embeds: [em] });
            });
        } catch (error) {
            if(error instanceof PublicError)
            {
                await followUpError(interaction, error.message);
            }else{
                await followUpError(interaction, '失敗しました。');
            }
            throw error;
        }
        em = new EmbedBuilder()
            .setTitle('▶ 完了')
            .setDescription('アイテムがキューに追加されました。')
            .addFields({ name: '追加されたアイテム', value: urlStr })
            .setColor(Colors.Aqua);
        await interaction.editReply({ embeds: [em] });
    }

}
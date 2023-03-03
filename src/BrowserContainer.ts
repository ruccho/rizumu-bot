import { BrowserWindow } from "electron";


export class BrowserContainer {
    private currentWindow?: BrowserWindow;
    private currentPreloadPath?: string;
    private headless: boolean;
    private instanceId: string;
    private prefix: string;

    constructor(headless: boolean, instanceId: string, prefix: string) {
        this.headless = headless;
        this.instanceId = instanceId;
        this.prefix = prefix;
    }

    open(url: string, preloadPath: string) {
        if (!this.currentWindow || preloadPath != this.currentPreloadPath) {

            this.close();

            const win = this.currentWindow = new BrowserWindow({
                width: 450,
                height: 400,
                show: !this.headless,
                webPreferences: {
                    preload: preloadPath,
                    //webviewTag: true,
                    offscreen: this.headless,
                    sandbox: false
                }
            });

            win.webContents.setFrameRate(10);

            win.webContents.addListener("console-message", (e, level, message) => {
                if (level === void 0 || level === 0)
                    console.log(`[${this.instanceId}] [${this.prefix}}] ${message}`)
                else if (level === 1)
                    console.info(`[${this.instanceId}] [${this.prefix}] ${message}`)
                else if (level === 2)
                    console.warn(`[${this.instanceId}] [${this.prefix}] ${message}`)
                else if (level === 3)
                    console.error(`[${this.instanceId}] [${this.prefix}] ${message}`)
            });

            this.currentWindow = win;
            this.currentPreloadPath = preloadPath;

        }

        const u = new URL(url);
        u.searchParams.set("rizumu_instance_id", this.instanceId);

        this.currentWindow.loadURL(u.toString());

    }

    close() {
        this.currentWindow?.close();
        this.currentWindow = undefined;

        this.currentPreloadPath = undefined;
    }

    get isAlive() {
        return this.currentWindow && !this.currentWindow.isDestroyed();
    }

    get currentWebContents() {
        return this.currentWindow?.webContents;
    }
}
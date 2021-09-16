

let instanceId = "";

let params = new URLSearchParams(location.search);
instanceId = params.get('instance_id');

console.log(instanceId);

const { contextBridge, ipcRenderer} = require("electron");

const rizumu = {
    on: (eventName, listener) => {
        console.log(`[CHILD] listening on ${eventName}-${instanceId}`);
        ipcRenderer.on(`${eventName}-${instanceId}`, (event, message) => {
            listener(message);
        })
    },
    send: (eventName, data) => {
        console.log(`[CHILD] sending on ${eventName}-${instanceId}`);
        ipcRenderer.send(`${eventName}-${instanceId}`, data);
    }
};


contextBridge.exposeInMainWorld(
    "rizumu", rizumu
);

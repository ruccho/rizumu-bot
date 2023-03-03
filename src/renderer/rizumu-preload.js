

let instanceId = "";

let params = new URLSearchParams(location.search);
instanceId = params.get('instance_id');

console.log(instanceId);

const { contextBridge, ipcRenderer } = require("electron");
const path = require('path');
const fs = require('fs');

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

const processorPath = 'bypass-processor.js';
const processorSource = fs.readFileSync(path.join(__dirname, "../../src/public/", processorPath));
const processorBlob = new Blob([processorSource.toString()], { type: 'text/javascript' });
const processorUrl = URL.createObjectURL(processorBlob);

contextBridge.exposeInMainWorld(
    "rizumu", rizumu
);

contextBridge.exposeInMainWorld(
    "processorUrl", processorUrl
);

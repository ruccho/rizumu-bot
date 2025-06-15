
import path from "path";
import fs from "fs";

const processorPath = 'bypass-processor.js';
const processorSource = fs.readFileSync(path.join(__dirname, "../public/", processorPath));
const processorBlob = new Blob([processorSource.toString()], { type: 'text/javascript' });
const processorUrl = URL.createObjectURL(processorBlob);

export async function addBypassProcessorModule(context: AudioContext) {
    await context.audioWorklet.addModule(processorUrl);
}
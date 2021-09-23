class BypassProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
    }

    process(inputs, outputs, parameters) {

        //stereo
        let f_input_channels = [[], []];

        for (let i = 0; i < inputs.length; i++) {
            const input = inputs[i];
            if (input.length >= 1) {
                for (let c_d = 0; c_d < f_input_channels.length; c_d++) {
                    const channel_dest = f_input_channels[c_d];
                    const c_s = c_d % input.length;
                    const channel_src = input[c_s];

                    for (let j = 0; j < channel_src.length; j++) {
                        if (j < channel_dest.length) {
                            channel_dest[j] += channel_src[j];
                        } else {
                            channel_dest.push(channel_src[j]);
                        }
                    }
                }
            }
        }

        for (let i = 0; i < outputs.length; i++) {
            const output = outputs[i];
            const output_channels = output.length;
            for (let c_o = 0; c_o < output_channels.length; c_o++) {
                const channel_output = output[c_o];
                const c_i = c_o % f_input_channels.length;
                const channel_input = f_input_channels[c_i];

                for (let j = 0; j < channel_output.length; j++) {
                    channel_output[j] = channel_input[j];
                }

            }
        }

        //Int16 x samples x channels
        const bufferBytes = 2 * f_input_channels[0].length * f_input_channels.length;
        if (!this.buffer || this.buffer.byteLength != bufferBytes)
            this.buffer = new ArrayBuffer(bufferBytes);
        const view = new Int16Array(this.buffer);

        //flatten
        //let f_input = []
        let v = 0;
        for (let s = 0; s < f_input_channels[0].length; s++) {
            for (let c = 0; c < f_input_channels.length; c++) {
                view[v] = Math.round(f_input_channels[c][s] * 32767 * 0.2);
                v++;
                //f_input.push(f_input_channels[c][s]);
            }
        }


        this.port.postMessage(this.buffer);
        //this.port.postMessage(f_input);

        // 処理を続ける
        return true;
    }
}

registerProcessor('bypass-processor', BypassProcessor);
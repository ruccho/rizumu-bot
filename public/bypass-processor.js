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
            /*
            if (outputs[i].length >= 2) {
                for (let j = 0; j < outputs[i][0].length; j++) {
                    outputs[i][0][j] = f_input[j];
                }

                for (let j = 0; j < outputs[i][1].length; j++) {
                    outputs[i][1][j] = f_input[j];
                }
            }
            */
        }

        //flatten
        let f_input = []
        for (let s = 0; s < f_input_channels[0].length; s++) {
            for (let c = 0; c < f_input_channels.length; c++) {
                f_input.push(f_input_channels[c][s]);
            }
        }

        this.port.postMessage(f_input);

        // 処理を続ける
        return true;
    }
}

registerProcessor('bypass-processor', BypassProcessor);
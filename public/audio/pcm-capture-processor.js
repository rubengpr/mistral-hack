class PcmCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.pendingSamples = [];
    this.targetSampleRate = 16000;
    this.minimumInputSamples = Math.max(256, Math.round(sampleRate * 0.04));
  }

  process(inputs) {
    const input = inputs[0]?.[0];

    if (!input) {
      return true;
    }

    for (let index = 0; index < input.length; index += 1) {
      this.pendingSamples.push(input[index]);
    }

    if (this.pendingSamples.length < this.minimumInputSamples) {
      return true;
    }

    const source = Float32Array.from(this.pendingSamples);
    this.pendingSamples.length = 0;
    const outputLength = Math.max(
      1,
      Math.round((source.length * this.targetSampleRate) / sampleRate),
    );
    const pcm = new Int16Array(outputLength);
    let squareTotal = 0;

    for (let index = 0; index < source.length; index += 1) {
      squareTotal += source[index] * source[index];
    }

    for (let index = 0; index < outputLength; index += 1) {
      const sourceIndex = Math.min(
        source.length - 1,
        Math.floor((index * sampleRate) / this.targetSampleRate),
      );
      const sample = Math.max(-1, Math.min(1, source[sourceIndex]));
      pcm[index] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    }

    this.port.postMessage(
      {
        type: 'audio',
        pcm: pcm.buffer,
        rms: Math.sqrt(squareTotal / source.length),
      },
      [pcm.buffer],
    );

    return true;
  }
}

registerProcessor('pcm-capture-processor', PcmCaptureProcessor);

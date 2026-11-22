const chord = [36.62, 54.99, 73.23, 82.2, 109.99, 138.57];
const bells = [585.86, 657.61, 738.15, 877.93, 985.45, 1171.73];

export function cosmosAudio() {
  let audio: AudioContext | undefined;
  let master: GainNode;
  let room: ConvolverNode;
  let enabled = false;

  function create() {
    const ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
    room = ctx.createConvolver();
    const seconds = 3.3;
    const impulse = ctx.createBuffer(2, Math.ceil(ctx.sampleRate * seconds), ctx.sampleRate);
    for (let channel = 0; channel < impulse.numberOfChannels; channel++) {
      const samples = impulse.getChannelData(channel);
      let softened = 0;
      for (let i = 0; i < samples.length; i++) {
        softened = .76 * softened + .24 * (Math.random() * 2 - 1);
        samples[i] = softened * (1 - i / samples.length) ** 3.4;
      }
    }
    room.buffer = impulse;
    const wet = ctx.createGain();
    wet.gain.value = .42;
    room.connect(wet).connect(master);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 300;
    filter.Q.value = .18;
    filter.connect(master);
    filter.connect(room);
    const lfo = ctx.createOscillator();
    const depth = ctx.createGain();
    lfo.frequency.value = .067;
    depth.gain.value = 120;
    lfo.connect(depth).connect(filter.frequency);
    lfo.start();
    chord.forEach((frequency, i) => {
      for (const detune of [-4, 4]) {
        const voice = ctx.createOscillator();
        const gain = ctx.createGain();
        voice.type = detune < 0 ? 'sine' : 'triangle';
        voice.frequency.value = frequency;
        voice.detune.value = detune;
        gain.gain.value = (i < 2 ? .024 : .014) * (detune < 0 ? 1 : .58);
        const pan = ctx.createStereoPanner();
        pan.pan.value = detune * .09;
        voice.connect(gain).connect(pan).connect(filter);
        voice.start();
      }
    });
    return ctx;
  }

  return {
    async enable(value: boolean) {
      if (value) {
        audio ??= create();
        await audio.resume();
      }
      enabled = value;
      if (audio) master.gain.setTargetAtTime(value ? .68 : 0, audio.currentTime, .24);
    },
    chime(note: number, position: number) {
      if (!enabled || !audio || audio.state !== 'running') return;
      const ctx = audio;
      const start = ctx.currentTime;
      const pan = ctx.createStereoPanner();
      pan.pan.value = Math.max(-.92, Math.min(.92, position));
      pan.connect(master);
      pan.connect(room);
      const frequency = bells[note % bells.length];
      [1, 2.01, 3.02].forEach((ratio, i) => {
        const bell = ctx.createOscillator();
        const envelope = ctx.createGain();
        bell.frequency.value = frequency * ratio;
        envelope.gain.setValueAtTime(.0001, start);
        envelope.gain.exponentialRampToValueAtTime(.065 / (i * 2 + 1), start + .025);
        envelope.gain.exponentialRampToValueAtTime(.0001, start + 2.4 - i * .42);
        bell.connect(envelope).connect(pan);
        bell.start(start);
        bell.stop(start + 2.5);
        bell.onended = () => { bell.disconnect(); envelope.disconnect(); if (i === 0) pan.disconnect(); };
      });
    },
  };
}

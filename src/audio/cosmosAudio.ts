const tones = [
  [108, .010, -.24, .037],
  [162, .0074, .23, .049],
  [216, .0047, -.42, .031],
  [270, .0031, .43, .041],
  [324, .0020, .07, .055],
];
const notes = [432, 486, 540, 648, 729];

export function cosmosAudio() {
  let audio: AudioContext | undefined;
  let master: GainNode;
  let space: GainNode;
  let enabled = false;

  function create() {
    const ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
    space = ctx.createGain();

    // Quiet stereo reflections soften the tones without adding a layer of noise.
    for (const [seconds, side, level] of [[.27, -.65, .095], [.41, .58, .067], [.63, -.22, .036]]) {
      const delay = ctx.createDelay();
      delay.delayTime.value = seconds;
      const soft = ctx.createBiquadFilter();
      soft.type = 'lowpass';
      soft.frequency.value = 610;
      const gain = ctx.createGain();
      gain.gain.value = level;
      const pan = ctx.createStereoPanner();
      pan.pan.value = side;
      space.connect(delay).connect(soft).connect(gain).connect(pan).connect(master);
    }

    for (const [pitch, level, side, rhythm] of tones) {
      const voice = ctx.createOscillator();
      voice.frequency.value = pitch;
      const gain = ctx.createGain();
      gain.gain.value = level;
      const pan = ctx.createStereoPanner();
      pan.pan.value = side;
      const breath = ctx.createOscillator();
      breath.frequency.value = rhythm;
      const depth = ctx.createGain();
      depth.gain.value = level * .15;
      breath.connect(depth).connect(gain.gain);
      voice.connect(gain).connect(pan).connect(master);
      pan.connect(space);
      breath.start();
      voice.start();
    }
    return ctx;
  }

  return {
    async enable(value: boolean) {
      if (value) {
        audio ??= create();
        await audio.resume();
      }
      enabled = value;
      if (audio) master.gain.setTargetAtTime(value ? .65 : 0, audio.currentTime, value ? .90 : .22);
    },
    chime(note: number, position: number) {
      if (!enabled || !audio || audio.state !== 'running') return;
      const ctx = audio;
      const start = ctx.currentTime;
      const pan = ctx.createStereoPanner();
      pan.pan.value = Math.max(-.62, Math.min(.62, position));
      pan.connect(master);
      pan.connect(space);
      const pitch = notes[note % notes.length];
      [1, 2].forEach((partial, i) => {
        const bell = ctx.createOscillator();
        const envelope = ctx.createGain();
        bell.frequency.value = pitch * partial;
        envelope.gain.setValueAtTime(.00001, start);
        envelope.gain.exponentialRampToValueAtTime(i ? .0011 : .0085, start + .115);
        envelope.gain.exponentialRampToValueAtTime(.00001, start + 2.15);
        bell.connect(envelope).connect(pan);
        bell.start(start);
        bell.stop(start + 2.23);
        bell.onended = () => { bell.disconnect(); envelope.disconnect(); if (i === 1) pan.disconnect(); };
      });
    },
  };
}

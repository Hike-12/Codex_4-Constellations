import './style.css';
import { cosmosAudio } from './audio/cosmosAudio';
import { constellations } from './data/constellations';
import { observatory } from './scene/observatory';

const el = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const atlas = el('atlas'), drawer = el('monograph'), hud = el('hud');
const restore = el<HTMLButtonElement>('restore');
const mode = el<HTMLButtonElement>('mode'), connect = el<HTMLButtonElement>('connect'), sound = el<HTMLButtonElement>('sound');
const audio = cosmosAudio();
const canvas = el<HTMLCanvasElement>('cosmos');
const pad = (n: number) => String(n).padStart(2, '0');
let selected = -1;
let drifting = !matchMedia('(prefers-reduced-motion: reduce)').matches;
let connecting = false;
let sounding = false;
let scene: ReturnType<typeof observatory> | undefined;

const ticks = constellations.map((c, i) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.setAttribute('aria-label', c.name);
  button.setAttribute('aria-pressed', 'false');
  const label = document.createElement('span');
  label.textContent = c.name;
  label.setAttribute('aria-hidden', 'true');
  button.append(label);
  button.addEventListener('click', () => select(i));
  atlas.append(button);
  return button;
});

function select(index: number) {
  if (selected >= 0) ticks[selected].setAttribute('aria-pressed', 'false');
  selected = index;
  drawer.hidden = index < 0;
  if (index >= 0) {
    const item = constellations[index];
    ticks[index].setAttribute('aria-pressed', 'true');
    el('figure-index').textContent = pad(index + 1) + ' / 24';
    el('figure-name').textContent = item.name;
    el('translation').textContent = item.translation;
    el('brightest').textContent = item.brightest;
    el('distance').textContent = '≈ ' + item.distance.toLocaleString('en-US') + ' light-years';
    el('note').textContent = item.note;
  }
  scene?.focus(index);
  updateControls();
}

function updateControls() {
  mode.setAttribute('aria-pressed', String(!drifting));
  el('mode-text').textContent = drifting ? 'Drift' : 'Explore';
  mode.querySelector('.switch')!.textContent = drifting ? ' / Explore' : ' / Drift';
  connect.setAttribute('aria-pressed', String(connecting));
  sound.setAttribute('aria-pressed', String(sounding));
  el('sound-text').textContent = sounding ? 'On' : 'Off';
  el('trace').hidden = !connecting;
  canvas.dataset.mode = connecting ? 'connect' : drifting ? 'drift' : 'explore';
  el('hint').textContent = connecting ? 'Trace neighboring stars to connect them'
    : drifting ? 'Select a star or choose a constellation' : 'Drag to look · Scroll to travel';
}

mode.onclick = () => {
  drifting = !drifting;
  if (connecting) toggleConnect(false);
  if (drifting && selected >= 0) select(-1);
  scene?.drift(drifting);
  updateControls();
};
function toggleConnect(value = !connecting) {
  connecting = value;
  scene?.connect(value);
  if (value && selected < 0) select(0);
  updateControls();
}
connect.onclick = () => toggleConnect();
sound.onclick = async () => {
  sound.disabled = true;
  try {
    await audio.enable(!sounding);
    sounding = !sounding;
  } catch {
    el('fallback').textContent = 'Audio could not start on this device.';
    el('fallback').hidden = false;
  } finally {
    sound.disabled = false;
    updateControls();
  }
};
el('close').onclick = () => {
  const previous = selected;
  select(-1);
  if (previous >= 0) ticks[previous].focus();
};
el('reset').onclick = () => { if (selected >= 0) scene?.reset(selected); };
function toggleHUD() {
  hud.hidden = !hud.hidden;
  el('reticle').hidden = hud.hidden;
  restore.hidden = !hud.hidden;
  (hud.hidden ? restore : el('hide')).focus({ preventScroll: true });
}
el('hide').onclick = restore.onclick = toggleHUD;
addEventListener('keydown', event => {
  if (event.altKey || event.shiftKey || event.ctrlKey || event.metaKey || event.repeat) return;
  if (event.key.toLowerCase() === 'h') toggleHUD();
  if (event.key === 'Escape') {
    if (hud.hidden) toggleHUD();
    else if (connecting) toggleConnect(false);
    else if (selected >= 0) select(-1);
  }
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    if (hud.hidden || !atlas.contains(document.activeElement)) return;
    event.preventDefault();
    const focused = ticks.indexOf(document.activeElement as HTMLButtonElement);
    const next = (focused + ticks.length + (event.key === 'ArrowRight' ? 1 : -1)) % ticks.length;
    ticks[next].focus();
  }
});

try {
  scene = observatory(canvas, {
    select,
    chime: audio.chime,
    telemetry(ra, dec, fps) {
      const raMinutes = Math.floor(ra * 4);
      const decMinutes = Math.floor(Math.abs(dec) * 60);
      el('ra').textContent = 'RA ' + pad(Math.floor(raMinutes / 60)) + 'ʰ ' + pad(raMinutes % 60) + 'ᵐ';
      el('dec').textContent = 'DEC ' + (dec < 0 ? '−' : '+') + pad(Math.floor(decMinutes / 60)) + '° ' + pad(decMinutes % 60) + '′';
      el('fps').textContent = (fps || '—') + ' FPS';
    },
    progress(index, count) {
      if (index !== selected) return;
      const total = constellations[index].points.length;
      el('trace-count').textContent = count === total ? 'Figure complete' : count + ' / ' + total + ' stars linked';
    },
  });
} catch {
  el('fallback').hidden = false;
  for (const button of [mode, connect]) button.disabled = true;
}
updateControls();

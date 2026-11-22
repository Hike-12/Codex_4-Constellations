import './style.css';
import { cosmosAudio } from './audio/cosmosAudio';
import { constellations } from './data/constellations';
import { destinations } from './data/destinations';
import { observatory } from './scene/observatory';

const el = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const atlas = el('atlas'), drawer = el('monograph'), hud = el('hud');
const restore = el<HTMLButtonElement>('restore');
const mode = el<HTMLButtonElement>('mode'), connect = el<HTMLButtonElement>('connect'), sound = el<HTMLButtonElement>('sound');
const showAtlas = el<HTMLButtonElement>('show-atlas'), showRoute = el<HTMLButtonElement>('show-route');
const advance = el<HTMLButtonElement>('advance'), reverse = el<HTMLButtonElement>('reverse');
const routeStops = el('route-stops'), source = el<HTMLAnchorElement>('source');
const audio = cosmosAudio();
const canvas = el<HTMLCanvasElement>('cosmos');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const pad = (n: number) => String(n).padStart(2, '0');
let selected = -1, stop = -1;
let drifting = !reducedMotion.matches;
let connecting = false;
let sounding = false;
let scene: ReturnType<typeof observatory> | undefined;
atlas.style.setProperty('--figures', String(constellations.length));

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

const stops = destinations.map((item, index) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = item.name;
  button.setAttribute('aria-pressed', 'false');
  button.title = item.region;
  button.addEventListener('click', () => visit(index));
  routeStops.append(button);
  return button;
});

function chart(route: boolean) {
  showAtlas.setAttribute('aria-pressed', String(!route));
  showRoute.setAttribute('aria-pressed', String(route));
  atlas.hidden = route;
  el('route').hidden = !route;
}
showAtlas.onclick = () => chart(false);
showRoute.onclick = () => chart(true);
function pageRoute(direction: number) {
  routeStops.scrollBy({ left: direction * routeStops.clientWidth * .76, behavior: reducedMotion.matches ? 'instant' : 'smooth' });
}
el('route-back').onclick = () => pageRoute(-1);
el('route-next').onclick = () => pageRoute(1);
routeStops.addEventListener('wheel', event => {
  if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
  event.preventDefault();
  routeStops.scrollLeft += event.deltaY;
}, { passive: false });

function dismiss() {
  if (selected >= 0) ticks[selected].setAttribute('aria-pressed', 'false');
  if (stop >= 0) stops[stop].setAttribute('aria-pressed', 'false');
  selected = stop = -1;
  drawer.hidden = true;
  source.hidden = true;
}

function visit(index: number) {
  dismiss();
  connecting = drifting = false;
  scene?.connect(false);
  stop = index;
  const item = destinations[index];
  stops[index].setAttribute('aria-pressed', 'true');
  drawer.hidden = false;
  el('figure-index').textContent = item.region;
  el('figure-name').textContent = item.name;
  el('translation').textContent = '';
  el('star-facts').hidden = true;
  el('note').textContent = item.note;
  if ('source' in item) { source.href = item.source; source.hidden = false; }
  scene?.visit(index);
  updateControls();
}

function select(index: number) {
  dismiss();
  if (index >= 0) {
    chart(false);
    selected = index;
    const item = constellations[index];
    ticks[index].setAttribute('aria-pressed', 'true');
    drawer.hidden = false;
    el('star-facts').hidden = false;
    el('figure-index').textContent = pad(index + 1) + ' / ' + constellations.length;
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
  advance.disabled = reverse.disabled = connecting || !scene;
  el('hint').textContent = connecting ? 'Trace neighboring stars to connect them' : 'Scroll to fly · Drag to turn';
}

mode.onclick = () => {
  drifting = !drifting;
  if (connecting) toggleConnect(false);
  if (drifting && (selected >= 0 || stop >= 0)) select(-1);
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
  const button = selected >= 0 && !atlas.hidden ? ticks[selected] : stop >= 0 && !el('route').hidden ? stops[stop] : undefined;
  select(-1);
  (button ?? (atlas.hidden ? showRoute : showAtlas)).focus({ preventScroll: true });
};
el('reset').onclick = () => { if (selected >= 0) scene?.reset(selected); };
function toggleHUD() {
  hud.hidden = !hud.hidden;
  el('reticle').hidden = hud.hidden;
  restore.hidden = !hud.hidden;
  (hud.hidden ? restore : el('hide')).focus({ preventScroll: true });
}
el('hide').onclick = restore.onclick = toggleHUD;
advance.onclick = () => scene?.thrust(370);
reverse.onclick = () => scene?.thrust(-370);
addEventListener('keydown', event => {
  if (event.altKey || event.shiftKey || event.ctrlKey || event.metaKey) return;
  const key = event.key.toLowerCase();
  if (key === 'w' || key === 's') { scene?.thrust(key === 'w' ? 90 : -90); return; }
  if (event.repeat) return;
  if (key === 'h') toggleHUD();
  if (event.key === 'Escape') {
    if (hud.hidden) toggleHUD();
    else if (connecting) toggleConnect(false);
    else if (selected >= 0 || stop >= 0) select(-1);
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
    navigate() {
      dismiss();
      drifting = false;
      updateControls();
    },
    telemetry(ra, dec, fps, range, sector, target) {
      const raMinutes = Math.floor(ra * 4);
      const decMinutes = Math.floor(Math.abs(dec) * 60);
      el('ra').textContent = 'RA ' + pad(Math.floor(raMinutes / 60)) + 'ʰ ' + pad(raMinutes % 60) + 'ᵐ';
      el('dec').textContent = 'DEC ' + (dec < 0 ? '−' : '+') + pad(Math.floor(decMinutes / 60)) + '° ' + pad(decMinutes % 60) + '′';
      el('fps').textContent = (fps || '—') + ' FPS';
      const readout = el('range');
      readout.textContent = 'Range ' + String(Math.round(range)).padStart(3, '0');
      readout.dataset.sector = sector;
      const sightline = el('sightline');
      sightline.textContent = target;
      sightline.hidden = !target;
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

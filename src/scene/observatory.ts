import { AdditiveBlending, Euler, Matrix4, Mesh, MeshBasicMaterial, PerspectiveCamera, Quaternion, RingGeometry, Scene, Vector3, WebGLRenderer } from 'three';
import { canLinkStar, connectStar, constellations, projectStar, waypointProgress } from '../data/constellations';
import { celestialBodies } from './celestialBodies';
import { makeFigures } from './constellations';
import { field, nebula } from './sky';
import { sectors } from './sectors';
import { blendBetween } from './distance';

type Callbacks = {
  select(index: number): void;
  telemetry(ra: number, dec: number, fps: number, range: number, sector: string, target: string): void;
  navigate(): void;
  chime(note: number, pan: number): void;
  progress(index: number, count: number): void;
};

export function observatory(canvas: HTMLCanvasElement, callbacks: Callbacks) {
  const renderer = new WebGLRenderer({ canvas, alpha: false, antialias: false, powerPreference: 'high-performance' });
  const scene = new Scene();
  const camera = new PerspectiveCamera(47, 1, .12, 4650);
  const sky = nebula();
  const stars = field(9900, 4140);
  const dust = field(950, 105, true);
  const bodies = celestialBodies();
  const frontier = sectors();
  const { figures, anchors } = makeFigures();
  scene.add(sky.dome, stars, dust, bodies.root, frontier.root, anchors, ...figures.map(f => f.lines));

  const ripple = new Mesh(new RingGeometry(.92, 1, 32), new MeshBasicMaterial({
    color: '#e0c49c', transparent: true, blending: AdditiveBlending, depthWrite: false,
  }));
  ripple.visible = false;
  scene.add(ripple);
  let pulseAt = -5;

  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const origin = new Vector3();
  const position = new Vector3();
  const viewPoint = new Vector3();
  const inverseLook = new Quaternion();
  const forward = new Vector3();
  const course = new Vector3();
  const requestedCourse = new Vector3();
  const step = new Vector3();
  const offset = new Vector3();
  const driftSide = new Vector3(...projectStar(177, 0));
  const driftCenter = new Vector3();
  let driftRa = 87, driftDec = -2;
  const projected = new Vector3();
  const up = new Vector3(0, 1, 0);
  const matrix = new Matrix4();
  const destination = new Quaternion();
  const startingLook = new Quaternion();
  const look = new Quaternion().setFromRotationMatrix(
    matrix.lookAt(origin, new Vector3(...projectStar(87, -2)), up),
  );
  const turn = look.clone();
  const angles = new Euler(0, 0, 0, 'YXZ');
  let steering = false, atlasOpacity = 1;
  let drift = !motion.matches, connecting = false, focus = -1, destinationIndex = -1;
  let pointerX = 0, pointerY = 0, travel = 0, speed = 0;
  let pressed: { x: number; y: number; dragged: boolean } | undefined;
  let flight: { at: number; from: Vector3; to: Vector3; duration: number } | undefined;
  let sector = '0:0:0';
  let time = 0, previous = 0, phase = 0, frames = 0, sample = 0;
  let baseFov = 47;
  let quality = 1;
  let slowSamples = 0;
  const visited = new Map<number, ReadonlySet<number>>();
  const empty = new Set<number>();

  function resizeRenderer() {
    const pixelBudget = Math.sqrt(1_650_000 / (innerWidth * innerHeight));
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.4, pixelBudget) * quality);
    renderer.setSize(innerWidth, innerHeight, false);
    for (const layer of [stars, dust, anchors]) layer.material.uniforms.pixelRatio.value = renderer.getPixelRatio();
  }

  function resize() {
    resizeRenderer();
    camera.aspect = innerWidth / innerHeight;
    baseFov = innerWidth < 650 ? 63 : 47;
    camera.fov = baseFov;
    camera.updateProjectionMatrix();
  }
  resize();
  addEventListener('resize', resize);

  function hit(x: number, y: number, eligibleOnly = false) {
    if (atlasOpacity < .13) return;
    let best: { figure: number; star: number } | undefined;
    let distance = 21 ** 2;
    for (const [figure, group] of figures.entries()) {
      if (connecting && focus >= 0 && figure !== focus) continue;
      for (const [star, point] of group.stars.entries()) {
        if (eligibleOnly && !canLinkStar(constellations[figure].edges, visited.get(figure) ?? empty, star)) continue;
        if (offset.copy(point).sub(camera.position).dot(forward) <= 0) continue;
        projected.copy(point).project(camera);
        const dx = (projected.x + 1) * innerWidth / 2 - x;
        const dy = (1 - projected.y) * innerHeight / 2 - y;
        const d = dx * dx + dy * dy;
        if (d < distance) { distance = d; best = { figure, star }; }
      }
    }
    return best;
  }

  function link(result: NonNullable<ReturnType<typeof hit>>, pan: number) {
    const { figure, star } = result;
    const before = visited.get(figure) ?? empty;
    const next = connectStar(constellations[figure].edges, before, star);
    if (before === next) return;
    visited.set(figure, next);
    pulseAt = time;
    ripple.position.copy(figures[figure].stars[star]);
    callbacks.chime(next.size - 1, pan);
    callbacks.progress(figure, next.size);
    if (next.size === figures[figure].stars.length) callbacks.chime(next.size + 2, pan);
  }

  canvas.addEventListener('pointerdown', e => {
    canvas.setPointerCapture(e.pointerId);
    pressed = { x: e.clientX, y: e.clientY, dragged: false };
    if (connecting) {
      const result = hit(e.clientX, e.clientY, true);
      if (result) {
        if (focus !== result.figure) callbacks.select(result.figure);
        link(result, e.clientX / innerWidth * 2 - 1);
      }
    }
  });
  canvas.addEventListener('pointermove', e => {
    pointerX = e.clientX / innerWidth * 2 - 1;
    pointerY = e.clientY / innerHeight * 2 - 1;
    if (connecting) {
      const result = hit(e.clientX, e.clientY, true);
      if (result && focus === result.figure) link(result, pointerX);
      return;
    }
    canvas.classList.toggle('over-star', !!hit(e.clientX, e.clientY));
    if (pressed) {
      const dx = e.clientX - pressed.x, dy = e.clientY - pressed.y;
      if (!pressed.dragged && Math.hypot(dx, dy) < 4) return;
      pressed = { x: e.clientX, y: e.clientY, dragged: true };
      beginNavigation();
      if (!steering) turn.copy(look);
      steering = true;
      angles.setFromQuaternion(turn);
      angles.y -= dx * .0044;
      angles.x = Math.max(-1.54, Math.min(1.54, angles.x - dy * .0039));
      angles.z = 0;
      turn.setFromEuler(angles);
    }
  });
  canvas.addEventListener('pointerup', e => {
    if (!pressed?.dragged && !connecting) {
      const result = hit(e.clientX, e.clientY);
      if (result) callbacks.select(result.figure);
    }
    pressed = undefined;
  });
  canvas.addEventListener('pointercancel', () => { pressed = undefined; });
  function beginNavigation() {
    if (drift || focus >= 0 || destinationIndex >= 0 || flight) callbacks.navigate();
    flight = undefined;
    focus = destinationIndex = -1;
    drift = false;
  }

  function thrust(delta: number) {
    if (connecting || delta === 0) return;
    beginNavigation();
    requestedCourse.set(0,0,-1).applyQuaternion(look);
    if (Math.abs(speed) < 2 || course.dot(requestedCourse) < .28) {
      speed = 0;
      course.copy(requestedCourse);
    }
    speed = Math.max(-225, Math.min(225, speed + Math.max(-62, Math.min(62, delta * .24))));
  }

  canvas.addEventListener('wheel', e => {
    if (connecting) return;
    e.preventDefault();
    const pixels = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? innerHeight : 1);
    thrust(Math.sign(pixels) * Math.min(250, Math.abs(pixels) * 1.6));
  }, { passive: false });

  function frame(now: number) {
    const dt = previous ? Math.min(.05, (now - previous) / 1000) : 1 / 60;
    previous = now;
    time += dt;
    if (flight) {
      const progress = waypointProgress((now - flight.at) / 1000, motion.matches ? .25 : flight.duration);
      look.slerpQuaternions(startingLook, destination, progress);
      position.copy(flight.from).lerp(flight.to, progress);
      if (progress >= 1) {
        flight = undefined;
        if (focus >= 0) callbacks.chime(focus, 0);
      }
    } else if (drift && focus < 0 && !connecting) {
      phase += dt * .10;
      const ra = driftRa + (driftCenter.lengthSq() === 0 && innerWidth < 650 ? 9 : 0) + Math.sin(phase) * 16 + Math.sin(phase * .41) * 11;
      const dec = driftDec + Math.sin(phase * .84) * 7;
      const target = offset.set(...projectStar(ra - pointerX * 4, dec - pointerY * 3));
      destination.setFromRotationMatrix(matrix.lookAt(origin, target, up));
      look.slerp(destination, 1 - Math.exp(-dt * 1.8));
      offset.set(...projectStar(87, 0, 14 * Math.sin(phase)));
      offset.addScaledVector(driftSide, 7 * (1 - Math.cos(phase)));
      offset.y = 3.7 * Math.sin(phase * 2);
      position.lerp(offset.add(driftCenter), 1 - Math.exp(-dt * .64));
    }
    if (steering && !flight && !drift) look.slerp(turn, 1 - Math.exp(-dt * 13));
    camera.quaternion.copy(look);
    forward.set(0, 0, -1).applyQuaternion(look);
    if (!flight && Math.abs(speed) > .025 && !drift && !connecting) {
      course.lerp(requestedCourse, 1 - Math.exp(-dt * 3)).normalize();
      step.copy(position).addScaledVector(course, speed * dt);
      bodies.avoid(position, step);
      frontier.avoid(position, step);
      travel += Math.sign(speed) * step.distanceTo(position) * .07;
      position.copy(step);
      speed *= Math.exp(-dt * 1.68);
    }
    camera.position.copy(position);
    let targetFov = baseFov;
    if (focus >= 0) {
      inverseLook.copy(flight ? destination : look).invert();
      const center = figures[focus].center;
      let extent = 0;
      for (const star of figures[focus].stars) {
        viewPoint.copy(star).addScaledVector(center, -29).applyQuaternion(inverseLook);
        if (viewPoint.z < -1) {
          extent = Math.max(extent, Math.abs(viewPoint.x / viewPoint.z) / camera.aspect,
            Math.abs(viewPoint.y / viewPoint.z));
        }
      }
      targetFov = Math.max(baseFov, Math.min(116, Math.atan(extent * 1.13) * 360 / Math.PI));
    }
    const nextFov = camera.fov + (targetFov - camera.fov) * (1 - Math.exp(-dt * 2));
    if (Math.abs(nextFov - camera.fov) > .002) {
      camera.fov = nextFov;
      camera.updateProjectionMatrix();
    }
    camera.updateMatrixWorld();
    sky.dome.position.copy(position);
    stars.position.copy(position);
    const atlasTarget = destinationIndex > 0 ? 0 : 1 - blendBetween(position.length(), 290, 560);
    atlasOpacity += (atlasTarget - atlasOpacity) * (1 - Math.exp(-dt * 5.5));
    anchors.material.uniforms.visibility.value = atlasOpacity;
    anchors.visible = atlasOpacity > .005;
    sky.update(renderer, camera.position, travel * .17 + phase * 2, now);
    const animationTime = motion.matches ? 0 : time;
    for (const layer of [stars, dust, anchors]) layer.material.uniforms.time.value = animationTime;
    dust.rotation.y = animationTime * .013;
    const ratio = renderer.getPixelRatio();
    const pixels = camera.projectionMatrix.elements[5] * innerHeight * ratio;
    bodies.update(animationTime, position, pixels);
    sector = frontier.update(position, animationTime, ratio, pixels);

    const hovered = hit((pointerX + 1) * innerWidth / 2, (pointerY + 1) * innerHeight / 2);
    figures.forEach((figure, index) => {
      const alignment = figure.center.dot(forward);
      const opacity = atlasOpacity * (focus === index ? .66 : hovered?.figure === index ? .43
        : connecting ? .055 : Math.max(0, (alignment - .84) * 2.1) * (focus < 0 ? 1 : .35));
      figure.update(dt, opacity, connecting ? (visited.get(index) ?? empty) : undefined);
    });

    const pulse = (time - pulseAt) / .95;
    ripple.visible = pulse < 1;
    if (ripple.visible) {
      ripple.quaternion.copy(look);
      ripple.scale.setScalar(.48 + pulse * 6);
      ripple.material.opacity = (1 - pulse) ** 2 * .8;
    }

    frames++;
    if (now - sample > 500) {
      const ra = (Math.atan2(-forward.z, forward.x) * 180 / Math.PI + 360) % 360;
      const dec = Math.asin(forward.y) * 180 / Math.PI;
      const fps = sample ? Math.round(frames * 1000 / (now - sample)) : 0;
      callbacks.telemetry(ra, dec, fps, position.length(), sector,
        !drift && !flight && !connecting && destinationIndex < 0 ? bodies.sightline(position, forward) : '');
      slowSamples = fps > 0 && fps < 47 ? slowSamples + 1 : 0;
      if (slowSamples === 3 && quality > .62) {
        quality *= .85;
        resizeRenderer();
        slowSamples = 0;
      }
      frames = 0;
      sample = now;
    }
    renderer.render(scene, camera);
  }
  renderer.setAnimationLoop(frame);

  function fly(to: Vector3, direction: Vector3) {
    steering = false;
    startingLook.copy(look);
    destination.setFromRotationMatrix(matrix.lookAt(origin, direction, up));
    flight = { at: performance.now(), from: position.clone(), to,
      duration: Math.min(7.2, 2.5 + Math.sqrt(to.distanceTo(position)) * .068) };
    speed = 0;
  }

  return {
    focus(index: number) {
      destinationIndex = -1;
      focus = index;
      if (index < 0) { flight = undefined; return; }
      const direction = figures[index].center;
      fly(direction.clone().multiplyScalar(29), direction);
      callbacks.progress(index, visited.get(index)?.size ?? 0);
    },
    visit(index: number) {
      focus = -1;
      drift = false;
      destinationIndex = index;
      const stop = bodies.entries[index];
      const extraRoom = index === 0 ? 0 : Math.max(0, .68 - camera.aspect) * 65;
      fly(stop.position.clone().addScaledVector(stop.direction, -extraRoom), stop.direction);
    },
    thrust,
    drift(value: boolean) {
      drift = value;
      if (!value) return;
      speed = 0;
      steering = false;
      driftCenter.copy(position);
      const heading = forward.set(0,0,-1).applyQuaternion(look);
      driftRa = Math.atan2(-heading.z, heading.x) * 180 / Math.PI;
      driftDec = Math.asin(heading.y) * 180 / Math.PI;
      phase = 0;
    },
    connect(value: boolean) { connecting = value; if (value) speed = 0; },
    reset(index: number) { visited.delete(index); callbacks.progress(index, 0); },
  };
}

import { CanvasTexture, RepeatWrapping } from 'three';
import coastline from '../data/earth.json';

export function earthMask() {
  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 384;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#fff';
  for (const polygon of coastline) {
    ctx.beginPath();
    for (const ring of polygon) {
      for (let i = 0; i < ring.length; i += 2) {
        const x = (ring[i] + 720) / 1440 * canvas.width;
        const y = (360 - ring[i + 1]) / 720 * canvas.height;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
    }
    ctx.fill('evenodd');
  }
  const texture = new CanvasTexture(canvas);
  texture.wrapS = RepeatWrapping;
  return texture;
}

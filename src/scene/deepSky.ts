import { AdditiveBlending, BufferAttribute, BufferGeometry, Points, ShaderMaterial } from 'three';
import { random } from './sky';

export function deepSky(kind: 'nebula' | 'cluster' | 'galaxy', radius: number) {
  const rng = random(kind === 'galaxy' ? 51 : 91);
  const positions: number[] = [], colors: number[] = [], strengths: number[] = [], sizes: number[] = [];
  const push = (x: number, y: number, z: number, tint: number[], size: number, power: number) => {
    positions.push(x * radius, y * radius, z * radius);
    colors.push(...tint);
    sizes.push(size * radius);
    strengths.push(power);
  };

  if (kind === 'galaxy') {
    for (let i = 0; i < 6800; i++) {
      const r = Math.pow(rng(), 1.7), bulge = 1 - r;
      const diffuse = i % 4 === 0;
      const a = diffuse ? rng() * Math.PI * 2 : (i % 2) * Math.PI + r * 6.4 + (rng() - .5) * (.92 + 1.9 * bulge * bulge);
      const x = r * Math.cos(a), z = r * Math.sin(a);
      push(x, (rng() - .5) * (.10 + .22 * bulge ** 12), z,
        r < .13 ? [1, .77, .49] : i % 5 === 0 ? [.64, .56, 1] : [.54, .66, .97],
        i % 11 === 0 ? .16 + .12 * bulge : .011 + .029 * bulge, i % 11 === 0 ? .029 : diffuse ? .15 : .26);
    }
  } else {
    const cluster = kind === 'cluster';
    for (let i = 0; i < (cluster ? 1000 : 1550); i++) {
      const a = rng() * Math.PI * 2, z = rng() * 2 - 1;
      const r = Math.pow(rng(), cluster ? 1.85 : .65);
      const s = Math.sqrt(1 - z * z) * r;
      const x = Math.cos(a) * s, y = Math.sin(a) * s;
      const dusty = i % 4 !== 0;
      const tint = cluster ? [.37, .60, 1] : i % 3 === 0 ? [.95, .43, .42] : [.54, .53, .99];
      push(x, y * (.60 + .25 * Math.sin(x * 10)), z * r * .52, tint,
        dusty ? .15 + rng() * .27 : .025 + rng() ** 3 * .09,
        dusty ? (cluster ? .023 : .038) : .75);
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute('tint', new BufferAttribute(new Float32Array(colors), 3));
  geometry.setAttribute('strength', new BufferAttribute(new Float32Array(strengths), 1));
  geometry.setAttribute('size', new BufferAttribute(new Float32Array(sizes), 1));
  return new Points(geometry, new ShaderMaterial({
    transparent: true, depthWrite: false, blending: AdditiveBlending,
    uniforms: { pixels: { value: 440 } },
    vertexShader: `
      attribute vec3 tint;
      attribute float size,strength;
      uniform float pixels;
      varying vec3 tone;
      varying float glow;
      void main(){
        vec4 p=modelViewMatrix*vec4(position,1.);
        gl_Position=projectionMatrix*p;
        gl_PointSize=clamp(size*pixels/max(3.,-p.z),1.,108.);
        tone=tint;
        glow=strength*smoothstep(1.,10.,-p.z);
      }
    `,
    fragmentShader: `
      varying vec3 tone;
      varying float glow;
      void main(){
        vec2 p=2.*gl_PointCoord-1.;
        float r=dot(p,p);
        gl_FragColor=vec4(tone,glow*exp(-6.*r)*(1.-smoothstep(.65,1.,r)));
      }
    `,
  }));
}

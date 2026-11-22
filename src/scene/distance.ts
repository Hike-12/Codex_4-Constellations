import { Color, DynamicDrawUsage, Float32BufferAttribute, BufferGeometry, Points, ShaderMaterial, Vector3 } from 'three';

export const detailRange = 2800;

// Keep a distant object within the depth buffer while preserving its direction
// and angular size. Its world position remains the source of truth.
export function placeForView(world: Vector3, eye: Vector3, render: Vector3) {
  const toward = render.copy(world).sub(eye);
  const stretch = Math.min(1, detailRange / Math.max(1, toward.length()));
  toward.multiplyScalar(stretch).add(eye);
  return stretch;
}

export function blendBetween(distance: number, start: number, end: number) {
  const t = Math.min(1, Math.max(0, (distance - start) / (end - start)));
  return t * t * (3 - 2 * t);
}

export function distantBodies(capacity: number) {
  const geometry = new BufferGeometry();
  const positions = new Float32BufferAttribute(new Float32Array(capacity * 3), 3).setUsage(DynamicDrawUsage);
  const colors = new Float32BufferAttribute(new Float32Array(capacity * 3), 3).setUsage(DynamicDrawUsage);
  const properties = new Float32BufferAttribute(new Float32Array(capacity * 3), 3).setUsage(DynamicDrawUsage);
  geometry.setAttribute('position', positions);
  geometry.setAttribute('colorTint', colors);
  geometry.setAttribute('details', properties);
  const mesh = new Points(geometry, new ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { pixels: { value: 700 } },
    vertexShader: `
      attribute vec3 colorTint,details;
      uniform float pixels;
      varying vec3 tint,lookLight;
      varying float disc,opacity,signal,pattern;
      void main(){
        vec4 view=modelViewMatrix*vec4(position,1.);
        gl_Position=projectionMatrix*view;
        float diameter=details.x*pixels/max(1.,-view.z);
        float extent=clamp(diameter+4.,4.5,190.);
        gl_PointSize=extent;
        disc=diameter/extent;
        signal=1.-smoothstep(1.,8.,diameter);
        opacity=details.y*step(1.,-view.z);
        if(details.z>1.5) opacity*=signal;
        pattern=mod(details.z,2.);
        tint=colorTint;
        lookLight=normalize(mat3(viewMatrix)*vec3(-.83,.42,.36));
      }
    `,
    fragmentShader: `
      varying vec3 tint,lookLight;
      varying float disc,opacity,signal,pattern;
      void main(){
        vec2 p=gl_PointCoord*2.-1.;
        float r=length(p);
        vec2 uv=p/max(.001,disc);
        float mask=1.-smoothstep(max(0.,disc-.065),disc+.065,r);
        vec3 n=normalize(vec3(uv.x,-uv.y,sqrt(max(0.,1.-dot(uv,uv)))));
        float lit=smoothstep(-.16,.85,dot(n,lookLight));
        float bands=.88+.12*sin(n.y*19.+sin(n.x*9.))*floor(pattern+.12);
        vec3 color=tint*(.14+.84*lit)*bands;
        float glow=exp(-r*r*10.)*(.18+.62*signal);
        float alpha=max(mask*(1.-signal*.62),glow);
        gl_FragColor=vec4(mix(color,tint*.94,signal),alpha*opacity);
      }
    `,
  }));
  mesh.frustumCulled = false;
  let count = 0;
  const viewCenter = new Vector3();
  return {
    mesh,
    begin(pixels: number) { count = 0; mesh.material.uniforms.pixels.value = pixels; },
    add(center: Vector3, eye: Vector3, radius: number, tint: Color, opacity: number, mode: number) {
      if (count >= capacity || opacity < .001) return;
      const scale = placeForView(center, eye, viewCenter);
      positions.setXYZ(count, viewCenter.x, viewCenter.y, viewCenter.z);
      colors.setXYZ(count, tint.r, tint.g, tint.b);
      properties.setXYZ(count, radius * scale, opacity, mode);
      count++;
    },
    end() {
      geometry.setDrawRange(0, count);
      positions.needsUpdate = colors.needsUpdate = properties.needsUpdate = true;
    },
  };
}

export function keepOutside(start: Vector3, end: Vector3, center: Vector3, radius: number) {
  const x = start.x - center.x, y = start.y - center.y, z = start.z - center.z;
  const dx = end.x - start.x, dy = end.y - start.y, dz = end.z - start.z;
  const squared = radius * radius;
  const project = x * dx + y * dy + z * dz;
  const startSquared = x * x + y * y + z * z;
  const travelSquared = dx * dx + dy * dy + dz * dz;
  if (startSquared < squared || project >= 0 || !travelSquared) return;
  const discriminant = project * project - travelSquared * (startSquared - squared);
  if (discriminant < 0) return;
  const surface = (-project - Math.sqrt(discriminant)) / travelSquared;
  if (surface < 0 || surface > 1) return;
  // Keep the lateral portion of the step so brushing a limb feels like sliding.
  const ex = end.x - center.x, ey = end.y - center.y, ez = end.z - center.z;
  const length = Math.hypot(ex, ey, ez);
  if (length < radius && length > .001) {
    end.set(center.x + ex * radius / length, center.y + ey * radius / length, center.z + ez * radius / length);
  } else {
    end.set(start.x + dx * surface, start.y + dy * surface, start.z + dz * surface);
  }
}

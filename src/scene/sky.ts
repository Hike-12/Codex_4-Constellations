import { AdditiveBlending, BackSide, BufferAttribute, BufferGeometry, Mesh, OrthographicCamera, PlaneGeometry, Points, Scene, ShaderMaterial, SphereGeometry, Vector3, WebGLRenderer, WebGLRenderTarget } from 'three';

export const noise = `
float hash(vec3 p) {
  p = fract(p * .3183099 + .1) * 17.;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float noise(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f*f*(3.-2.*f);
  return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
    mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);
}
float fbm(vec3 p) {
  return .52*noise(p)+.26*noise(p*2.13+9.)+.14*noise(p*4.27)+.08*noise(p*8.61);
}
`;

export function nebula() {
  const clouds = new WebGLRenderTarget(896, 448, { depthBuffer: false });
  const bakeScene = new Scene();
  const bakeCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const generator = new ShaderMaterial({
    uniforms: { travel: { value: 0 }, eye: { value: new Vector3() } },
    vertexShader: `
      varying vec2 coord;
      void main(){ coord=uv; gl_Position=vec4(position.xy,0.,1.); }
    `,
    fragmentShader: `
      varying vec2 coord;
      uniform float travel;
      uniform vec3 eye;
      ${noise}
      void main(){
        float phi=coord.x*6.2831853, theta=(1.-coord.y)*3.14159265;
        vec3 d=vec3(-cos(phi)*sin(theta),cos(theta),sin(phi)*sin(theta));
        vec3 normal=normalize(vec3(.74,.49,-.40));
        float lane=dot(d,normal);
        float band=exp(-abs(lane)*5.6);
        vec3 p=d*5.7+vec3(1.7,4.8,travel*.013);
        float warp=fbm(p*1.9);
        float a=fbm(p+warp*2.1);
        float b=fbm(p*2.8-vec3(warp*2.5));
        float storm=smoothstep(.23,.77,a*.72+b*.28);
        float ridge=exp(-abs(lane + (warp-.52)*.35)*15.);
        float density=band*storm*.82+ridge*storm*.32;
        vec3 col=vec3(.014,.019,.035);
        col+=vec3(.105,.16,.27)*density;
        col+=vec3(.28,.20,.13)*pow(storm,2.9)*ridge;
        float shaft=pow(max(0.,dot(d,normalize(vec3(-.15,.13,-1.)))),29.);
        col+=vec3(.15,.12,.085)*shaft*storm*band*.7;
        // Integrate three depths of local mist in front of the distant cloud bank.
        float transmittance=1.;
        vec3 haze=vec3(0.);
        for(int i=0; i<3; i++){
          float depth=.55+float(i)*.61;
          vec3 samplePoint=eye*.018+d*depth*3.1+vec3(4.2,8.1,1.4);
          float pocket=smoothstep(.30,.77,noise(samplePoint)*.74+noise(samplePoint*2.6)*.26);
          float mist=band*pocket*.15;
          float light=shaft*.7+pow(max(0.,dot(d,vec3(-.86,.02,-.50))),28.)*.28;
          haze+=transmittance*mist*(vec3(.035,.053,.095)+light*vec3(.14,.106,.078));
          transmittance*=exp(-mist);
        }
        col=col*transmittance+haze;
        float dark=smoothstep(.36,.69,fbm(p*1.7+warp*2.))*band;
        col*=1.-dark*.61;
        gl_FragColor=vec4(col,1.);
      }
    `,
  });
  const quad = new Mesh(new PlaneGeometry(2, 2), generator);
  quad.frustumCulled = false;
  bakeScene.add(quad);
  const dome = new Mesh(new SphereGeometry(810, 48, 28), new ShaderMaterial({
    side: BackSide, depthWrite: false,
    uniforms: { clouds: { value: clouds.texture } },
    vertexShader: `
      varying vec3 world;
      void main(){ world=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }
    `,
    fragmentShader: `
      varying vec3 world;
      uniform sampler2D clouds;
      void main(){
        vec3 ray=normalize(world);
        float u=fract(atan(ray.z,-ray.x)*.15915494+1.);
        float v=1.-acos(clamp(ray.y,-1.,1.))*.31830989;
        float grain=fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715))));
        gl_FragColor=vec4(texture2D(clouds,vec2(u,v)).rgb+(grain-.5)*.005,1.);
      }
    `,
  }));
  let nextBake = 0;
  return { dome, update(renderer: WebGLRenderer, eye: Vector3, travel: number, now: number) {
    if (now < nextBake) return;
    nextBake = now + 480;
    generator.uniforms.travel.value = travel;
    generator.uniforms.eye.value.copy(eye);
    renderer.setRenderTarget(clouds);
    renderer.render(bakeScene, bakeCamera);
    renderer.setRenderTarget(null);
  }};
}

export function starMaterial(scale = 1) {
  return new ShaderMaterial({
    transparent: true, depthWrite: false, blending: AdditiveBlending,
    uniforms: { time: {value: 0}, pixelRatio: {value: 1}, scale: {value: scale} },
    vertexShader: `
      attribute vec3 tint;
      attribute float size;
      attribute float power;
      attribute float phase;
      varying vec3 c;
      varying float intensity;
      varying float flair;
      uniform float time;
      uniform float pixelRatio;
      uniform float scale;
      void main(){
        vec4 p=modelViewMatrix*vec4(position,1.);
        gl_Position=projectionMatrix*p;
        gl_PointSize=clamp(size*scale*pixelRatio,1.,64.);
        c=tint;
        intensity=power*(.83+.17*sin(time*(.4+phase*.8)+phase*49.));
        flair=smoothstep(5.,13.,size);
      }
    `,
    fragmentShader: `
      varying vec3 c;
      varying float intensity;
      varying float flair;
      void main(){
        vec2 p=gl_PointCoord*2.-1.;
        float r=length(p);
        float core=exp(-r*r*125.);
        float halo=exp(-r*r*14.)*.33;
        float rays=(exp(-abs(p.x)*33.-abs(p.y)*3.7)+exp(-abs(p.y)*33.-abs(p.x)*3.7))*.29*flair;
        float alpha=(core+halo+rays)*(1.-smoothstep(.7,1.,r))*intensity;
        gl_FragColor=vec4(mix(c,vec3(1.),core*.75),alpha);
      }
    `,
  });
}

export function starPoints(positions: number[], colors: number[], sizes: number[], powers: number[], scale?: number) {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute('tint', new BufferAttribute(new Float32Array(colors), 3));
  geometry.setAttribute('size', new BufferAttribute(new Float32Array(sizes), 1));
  geometry.setAttribute('power', new BufferAttribute(new Float32Array(powers), 1));
  geometry.setAttribute('phase', new BufferAttribute(Float32Array.from(sizes, (_, i) => (i * .6180339) % 1), 1));
  return new Points(geometry, starMaterial(scale));
}

export function random(seed = 401) {
  return () => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

export function field(count: number, radius: number, dust = false) {
  const positions: number[] = [], colors: number[] = [], sizes: number[] = [], powers: number[] = [];
  const rng = random(dust ? 17 : 401);
  for (let i = 0; i < count; i++) {
    const y = 2 * rng() - 1, a = rng() * Math.PI * 2;
    const plane = Math.sqrt(1 - y * y);
    const r = radius * (dust ? .13 + .87 * rng() : .8 + .2 * rng());
    positions.push(r * plane * Math.cos(a), r * y, r * plane * Math.sin(a));
    colors.push(...(rng() > .79 ? [1, .8, .57] : [.67, .78, 1]));
    const brightness = rng() ** 8;
    sizes.push(dust ? 5 + rng() * 14 : 2.8 + brightness * 15);
    powers.push(dust ? .12 + rng() * .18 : .20 + brightness * .75);
  }
  return starPoints(positions, colors, sizes, powers);
}

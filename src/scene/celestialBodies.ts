import { AdditiveBlending, BackSide, Color, DoubleSide, Group, Mesh, RingGeometry, ShaderMaterial, SphereGeometry, Vector3 } from 'three';
import { destinations } from '../data/destinations';
import { projectStar } from '../data/constellations';
import { deepSky } from './deepSky';
import { earthMask } from './earth';
import { distantBodies, keepOutside, placeForView } from './distance';
import { noise, starPoints } from './sky';

const light = new Vector3(-.83,.42,.36).normalize();

export function sphere(radius: number, kind: number, tint = '#c69c78', detail = 48) {
  return new Mesh(new SphereGeometry(radius, detail, Math.max(12, detail * .65)), new ShaderMaterial({
    uniforms: { kind: { value: kind }, light: { value: light }, time: { value: 0 }, opacity: { value: 1 }, landMap: { value: kind === 2 ? earthMask() : null },
      tint: { value: new Color(tint).convertLinearToSRGB() } },
    vertexShader: `
      varying vec3 surface,normalWorld,view;
      void main(){
        surface=normalize(position);
        normalWorld=normalize(mat3(modelMatrix)*normal);
        vec4 p=modelMatrix*vec4(position,1.);
        view=cameraPosition-p.xyz;
        gl_Position=projectionMatrix*viewMatrix*p;
      }
    `,
    fragmentShader: `
      varying vec3 surface,normalWorld,view;
      uniform float kind,time,opacity;
      uniform vec3 light,tint;
      uniform sampler2D landMap;
      ${noise}
      void main(){
        vec3 n=normalize(normalWorld),v=normalize(view),p=normalize(surface);
        float day=dot(n,light), lit=smoothstep(-.14,.93,day);
        float rim=pow(1.-max(dot(n,v),0.),4.);
        vec3 c;
        if(kind<1.5){
          float flow=fbm(p*8.+time*.025);
          float bands=.5+.5*sin(p.y*(kind<.5?54.:29.)+flow*6.);
          float wisps=fbm(p*vec3(20.,58.,20.)+flow*5.);
          c=tint*(.47+.39*bands+.27*flow+.20*wisps);
          if(kind>.5){
            float storm=length((p.xy-vec2(-.23,-.21))*vec2(1.1,2.4))+flow*.055;
            c=mix(c,vec3(.68,.32,.22)*(.67+.24*sin(storm*78.)),(1.-smoothstep(.06,.15,storm))*smoothstep(.05,.22,p.z)*.85);
          }
          c=mix(vec3(.025,.028,.041),c,lit*.95);
          c+=rim*(.08+lit*.39)*vec3(.41,.47,.58);
        }else if(kind<2.5){
          float land=fbm(p*4.6+vec3(.7,0,1.3));
          float green=fbm(p*15.);
          vec2 globe=vec2(fract(atan(p.z,-p.x)*.15915494+.25),asin(clamp(p.y,-1.,1.))*.31830989+.5);
          float coast=smoothstep(.19,.82,texture2D(landMap,globe).r);
          float clouds=smoothstep(.51,.70,fbm(p*vec3(8.,13.,8.)+vec3(time*.019,0,0)+land*.6));
          float polar=smoothstep(.76,.97,abs(p.y)+(green-.5)*.19);
          float glint=pow(max(dot(n,normalize(light+v)),0.),65.)*(1.-coast);
          vec3 ocean=mix(vec3(.035,.105,.22),vec3(.12,.28,.40),green);
          vec3 ground=mix(vec3(.44,.34,.19),vec3(.12,.27,.15),smoothstep(.25,.64,green+abs(p.y)*.16));
          c=mix(ocean,ground,coast);
          c=mix(c,vec3(.72,.82,.88),max(polar,clouds*.79));
          c=c*(.055+lit*.96)+vec3(.48,.61,.66)*glint*.48;
          c+=rim*(.24+lit*.43)*vec3(.23,.52,.92);
        }else if(kind<3.5){
          float ground=fbm(p*5.)*.67+fbm(p*28.)*.33;
          float relief=0.;
          for(int i=0;i<8;i++){
            float k=float(i)+1.;
            vec3 impact=normalize(vec3(sin(k*12.6+.4),cos(k*7.73),sin(k*9.13+tint.r)));
            float rr=length(p-impact)/(.115+hash(vec3(k,3.,1.))*.26);
            relief+=(smoothstep(.63,.89,rr)-smoothstep(.91,1.04,rr))*.16
              -(1.-smoothstep(.25,.83,rr))*.14;
          }
          c=tint*clamp(.40+ground*.81+relief,.07,1.);
          c*=.085+lit*.92;
        }else if(kind<4.5){
          float ice=fbm(p*8.+2.7);
          float faults=pow(1.-abs(sin(p.x*13.+p.z*8.+fbm(p*9.)*11.)),15.);
          float grain=fbm(p*32.);
          c=mix(vec3(.26,.35,.39),vec3(.65,.77,.80),ice+grain*.27);
          c=mix(c,vec3(.52,.28,.17),faults*.32)*(lit*.93+.075);
          c+=rim*vec3(.29,.49,.72)*(.15+lit*.20);
        }else if(kind<5.5){
          float swirl=fbm(p*7.+vec3(time*.018,0,0));
          float clouds=fbm(p*vec3(12.,23.,12.)+swirl*3.);
          float band=.5+.5*sin(p.y*30.+swirl*3.);
          c=tint*(.66+.37*clouds+.19*band)*(.08+lit*.88);
          c+=rim*tint*(.074+lit*.30);
        }else{
          float granules=fbm(p*20.+time*.05);
          float spots=smoothstep(.44,.74,fbm(p*7.));
          c=tint*(.62+granules*.61-spots*.14)+vec3(.16)*max(dot(n,v),0.);
        }
        gl_FragColor=vec4(c,opacity);
      }
    `,
  }));
}

function atmosphere(radius: number, tint: string, star = false) {
  return new Mesh(new SphereGeometry(radius * (star ? 1.75 : 1.10), 44, 26), new ShaderMaterial({
    side: BackSide, transparent: true, depthWrite: false, blending: AdditiveBlending,
    uniforms: { tint: { value: new Color(tint).convertLinearToSRGB() }, light: { value: light },
      core: { value: star ? 1 / 1.75 : 1 / 1.10 }, intensity: { value: star ? 1 : .32 } },
    vertexShader: `
      varying vec3 n,v;
      void main(){
        vec4 p=modelMatrix*vec4(position,1.);
        n=normalize(mat3(modelMatrix)*normal);
        v=cameraPosition-p.xyz;
        gl_Position=projectionMatrix*viewMatrix*p;
      }
    `,
    fragmentShader: `
      varying vec3 n,v;
      uniform vec3 tint,light;
      uniform float core,intensity;
      void main(){
        vec3 view=normalize(v), normal=normalize(n);
        float mu=abs(dot(view,normal)), r=sqrt(max(0.,1.-mu*mu));
        float edge=clamp((r-core)/(1.-core),0.,1.);
        float glow=exp(-6.1*edge)*smoothstep(0.,.45,mu);
        float day=mix(.24,1.,smoothstep(-.55,.7,dot(normal+view*.6,light)));
        gl_FragColor=vec4(tint,glow*day*intensity);
      }
    `,
  }));
}

function rings(radius: number, thin: boolean) {
  const mesh = new Mesh(new RingGeometry(1.21, thin ? 1.95 : 2.37, 112), new ShaderMaterial({
    side: DoubleSide, transparent: true, depthWrite: false,
    uniforms: { opacity: { value: thin ? .21 : 1 }, light: { value: light } },
    vertexShader: `
      varying vec3 p,relative;
      void main(){
        p=position;
        relative=mat3(modelMatrix)*p/length(mat3(modelMatrix)*vec3(1.,0.,0.));
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
      }
    `,
    fragmentShader: `
      varying vec3 p,relative;
      uniform float opacity;
      uniform vec3 light;
      void main(){
        float r=length(p.xy);
        float grain=.5+.5*sin(r*343.+sin(r*112.))*(1.-smoothstep(.002,.010,fwidth(r)));
        float divisions=smoothstep(.13,.73,.5+.5*sin(r*31.));
        float gap=smoothstep(.023,.055,abs(r-1.87));
        float edge=smoothstep(1.21,1.33,r)*(1.-smoothstep(2.22,2.37,r));
        float along=dot(relative,light);
        float shadow=along<0.?smoothstep(.77,1.10,length(relative-light*along)):1.;
        vec3 dust=mix(vec3(.48,.47,.54),vec3(.86,.73,.58),grain);
        gl_FragColor=vec4(dust*(.28+.72*shadow),edge*gap*(.13+divisions*.39+grain*.15)*opacity);
      }
    `,
  }));
  mesh.scale.setScalar(radius);
  mesh.rotation.x = Math.PI * .5 - .15;
  return mesh;
}

export function celestialBodies() {
  const root = new Group();
  const animated: ReturnType<typeof sphere>[] = [];
  const signals = distantBodies(destinations.length);
  root.add(signals.mesh);
  const landmarks: { name: string; group: Group; center: Vector3; radius: number; tint: Color;
    solid: boolean; cloud?: ReturnType<typeof deepSky> }[] = [];
  const entries = destinations.map(item => {
    const position = new Vector3(...projectStar(item.ra, item.dec, item.depth));
    const direction = new Vector3(...projectStar(item.ra, item.dec));
    if (item.kind === 'home') return { position, direction };
    const group = new Group();
    group.position.copy(position);
    root.add(group);
    const starTint = 'tint' in item ? item.tint :
      item.kind === 'sun' || item.kind === 'saturn' ? '#e2be93' : item.kind === 'jupiter' ? '#d8af9a' : '#9bb8ec';
    const landmark: typeof landmarks[number] = { name: item.name, group, center: position, radius: item.radius,
      tint: new Color(starTint).convertLinearToSRGB(), solid: true };
    landmarks.push(landmark);
    if (item.kind === 'galaxy' || item.kind === 'cluster' || item.kind === 'nebula') {
      const volume = deepSky(item.kind, item.radius);
      if (item.kind === 'galaxy') volume.rotation.set(.12, -.22, -.25);
      group.add(volume);
      landmark.cloud = volume;
      landmark.solid = false;
    } else if (item.kind === 'binary') {
      const amber = sphere(2.4, 6, '#ffac68'), blue = sphere(1.62, 6, '#9fc2ff');
      const amberGlow = atmosphere(2.4, '#ffc37d', true), blueGlow = atmosphere(1.62, '#9abaff', true);
      amber.position.x = amberGlow.position.x = -3.1;
      blue.position.set(3.6, 1.5, -.7);
      blueGlow.position.copy(blue.position);
      group.add(amber, blue, amberGlow, blueGlow);
      animated.push(amber, blue);
      landmark.solid = false;
    } else {
      const gas = item.kind === 'saturn' || item.kind === 'jupiter';
      const kind = item.kind === 'saturn' ? 0 : item.kind === 'jupiter' ? 1 :
        item.kind === 'earth' ? 2 : item.kind === 'rock' ? 3 : item.kind === 'ice' ? 4 :
          item.kind === 'sun' ? 6 : 5;
      const tint = 'tint' in item ? item.tint : gas ? '#c9af91' : item.kind === 'sun' ? '#ffb05e' : '#9db6dd';
      const body = sphere(item.radius, kind, tint);
      group.add(body);
      animated.push(body);
      if (item.kind !== 'rock') {
        const halo = item.kind === 'earth' ? '#79b7fc' : item.kind === 'ice' ? '#9fc9f4' : tint;
        group.add(atmosphere(item.radius, halo, item.kind === 'sun'));
      }
      if (item.kind === 'saturn' || item.kind === 'uranus') {
        group.rotation.set(item.kind === 'saturn' ? -.24 : .72, -.28, item.kind === 'saturn' ? -.28 : .91);
        group.add(rings(item.radius, item.kind === 'uranus'));
      }
      if (item.kind === 'jupiter') {
        const moon = sphere(3, 3, '#c4a078', 22);
        moon.position.set(-41, -11, 14);
        group.add(moon);
      }
      if (item.kind === 'sun') {
        group.add(starPoints([0,0,0], [1,.62,.25], [63], [.32]));
      }
    }
    const standOff = item.kind === 'saturn' ? 5.8 : item.kind === 'nebula' ? 1.55 : item.kind === 'cluster' ? 2 :
      item.kind === 'galaxy' ? 2.75 : item.kind === 'sun' ? 5.4 : 3.75;
    return { position: position.clone().addScaledVector(direction, -item.radius * standOff), direction };
  });

  const bearing = new Vector3();
  return { root, entries, sightline(eye: Vector3, forward: Vector3) {
    let name = '', alignment = .99982, distance = Infinity;
    for (const item of landmarks) {
      bearing.copy(item.center).sub(eye);
      const range = bearing.length();
      if (range < 135) continue;
      const dot = bearing.dot(forward) / range;
      if (dot > alignment || (dot === alignment && range < distance)) {
        name = item.name;
        alignment = dot;
        distance = range;
      }
    }
    return name;
  }, avoid(start: Vector3, next: Vector3) {
    for (const item of landmarks) if (item.solid) keepOutside(start, next, item.center, item.radius * 1.15);
  }, update(time: number, eye: Vector3, pixels: number) {
    signals.begin(pixels);
    for (const item of landmarks) {
      const scale = placeForView(item.center, eye, item.group.position);
      item.group.scale.setScalar(scale);
      if (item.cloud) item.cloud.material.uniforms.pixels.value = pixels * .46 * scale;
      signals.add(item.center, eye, item.radius, item.tint, .80, 2);
    }
    signals.end();
    for (const body of animated) {
      body.rotation.y = time * .017;
      body.material.uniforms.time.value = time;
    }
  }};
}

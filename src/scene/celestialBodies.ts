import { DoubleSide, Group, Mesh, RingGeometry, ShaderMaterial, SphereGeometry, Vector3 } from 'three';
import { projectStar } from '../data/constellations';
import { noise } from './sky';

function sphere(radius: number, kind: number, light: Vector3) {
  return new Mesh(new SphereGeometry(radius, 56, 36), new ShaderMaterial({
    uniforms: { kind: { value: kind }, light: { value: light }, time: { value: 0 } },
    vertexShader: `
      varying vec3 surface;
      varying vec3 normalWorld;
      varying vec3 view;
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
      uniform float kind,time;
      uniform vec3 light;
      ${noise}
      void main(){
        vec3 n=normalize(normalWorld), v=normalize(view), p=normalize(surface);
        float day=dot(n,light);
        float diffuse=smoothstep(-.19,.93,day);
        float rim=pow(1.-max(dot(n,v),0.),3.8);
        vec3 c;
        if(kind<.5){
          float turbulence=fbm(p*8.+time*.035);
          float bands=.5+.5*sin(p.y*53.+turbulence*6.);
          float grain=fbm(p*38.+turbulence*4.);
          c=mix(vec3(.27,.21,.19),vec3(.81,.68,.53),bands*.36+turbulence*.5+grain*.17);
          c=mix(vec3(.027,.029,.046),c,diffuse*.93);
          c+=vec3(.27,.33,.44)*rim*(.13+diffuse*.62);
        }else if(kind<1.5){
          float ocean=fbm(p*9.);
          float cloud=smoothstep(.47,.71,fbm(p*10.+vec3(time*.08,0,0)+ocean));
          float glint=pow(max(dot(n,normalize(light+v)),0.),58.);
          c=mix(vec3(.024,.084,.13),vec3(.10,.24,.28),ocean)*diffuse;
          c+=vec3(.62,.76,.84)*(cloud*.68*diffuse+glint*.46+rim*(.09+diffuse*.43));
        }else{
          float convection=fbm(p*16.+time*.065);
          vec3 tint=kind<2.5?vec3(1.,.63,.32):vec3(.65,.79,1.);
          c=tint*(.65+convection*.58)+vec3(.2)*pow(max(dot(n,v),0.),.6);
        }
        gl_FragColor=vec4(c,1.);
      }
    `,
  }));
}

export function celestialBodies() {
  const root = new Group();
  const light = new Vector3(-.83,.42,.36).normalize();
  const giant = new Group();
  giant.position.set(...projectStar(113, 3, 82));
  giant.rotation.set(.31, -.28, -.28);
  const gas = sphere(8.4, 0, light);
  giant.add(gas);
  const rings = new Mesh(new RingGeometry(10.2, 19.9, 112), new ShaderMaterial({
    side: DoubleSide, transparent: true, depthWrite: false,
    vertexShader: `
      varying vec3 p;
      void main(){ p=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }
    `,
    fragmentShader: `
      varying vec3 p;
      void main(){
        float r=length(p.xy);
        float grain=.5+.5*sin(r*44.+sin(r*13.7))*(1.-smoothstep(.017,.067,fwidth(r)));
        float divisions=smoothstep(.13,.73,.5+.5*sin(r*3.64));
        float cassini=smoothstep(.21,.48,abs(r-15.7));
        float edge=smoothstep(10.2,11.4,r)*(1.-smoothstep(18.6,19.9,r));
        float shade=.47+.53*smoothstep(-6.,18.,-p.x);
        gl_FragColor=vec4(mix(vec3(.48,.47,.52),vec3(.83,.71,.55),grain)*shade,
          edge*cassini*(.13+divisions*.37+grain*.15));
      }
    `,
  }));
  rings.rotation.x = Math.PI * .5 - .15;
  giant.rotation.x = -.24;
  giant.add(rings);
  const moon = sphere(4.6, 1, light);
  moon.position.set(...projectStar(66, -16, 93));
  const primary = sphere(2.25, 2, light);
  const secondary = sphere(1.57, 3, light);
  primary.position.set(...projectStar(154, 2, 122));
  secondary.position.set(...projectStar(156.7, 3.3, 124));
  root.add(giant, moon, primary, secondary);
  return { root, update(time: number) {
    for (const body of [gas, moon, primary, secondary]) {
      body.rotation.y = time * .017;
      body.material.uniforms.time.value = time;
    }
  }};
}

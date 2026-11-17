export const skyVertex = `
varying vec3 vPosition;
void main(){vPosition=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}
`;
export const skyFragment = `
uniform vec3 topColor;
uniform vec3 horizonColor;
uniform vec3 sunColor;
uniform float time;
uniform float night;
varying vec3 vPosition;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f); return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
float fbm(vec2 p){return noise(p)*.55+noise(p*2.03)*.25+noise(p*4.13)*.13+noise(p*8.2)*.06;}
void main(){
 vec3 d=normalize(vPosition); float h=clamp(d.y*1.8,0.,1.);
 vec3 col=mix(horizonColor,topColor,pow(h,.65));
 float cloud=fbm(d.xz/(abs(d.y)+.23)*2.0+vec2(time*.008,0));
 col+=sunColor*smoothstep(.46,.8,cloud)*.17*(1.-h*.7);
 vec3 sunDir=normalize(vec3(.48,.11,-1.));float sun=max(dot(d,sunDir),0.);
 col+=sunColor*(pow(sun,13.)*.15+pow(sun,160.)*.16)*(1.-night*.93);
 float aurora=sin(d.x*7.+fbm(d.xz*5.+time*.018)*5.+time*.04)*.5+.5;
 float veil=pow(aurora,10.)*exp(-pow((d.y-.33)*4.,2.));
 col+=vec3(.1,.48,.35)*veil*.17*night;gl_FragColor=vec4(col,1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}
`;
export const waterVertex = `
uniform float time;uniform float beat;varying vec3 vWorld;
void main(){vec3 p=position;p.z+=sin(p.x*.42+time*.6)*.035+sin(p.y*.5-time*.8)*.045;
 vec4 wp=modelMatrix*vec4(p,1.);vWorld=wp.xyz;gl_Position=projectionMatrix*viewMatrix*wp;}
`;
export const waterFragment = `
uniform float time;uniform float beat;uniform vec3 deepColor;uniform vec3 lightColor;varying vec3 vWorld;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
void main(){vec2 p=vWorld.xz;
 float distort=sin(p.x*1.7+p.y*.6-time*.5)*.7+sin(p.y*2.6+p.x*1.3+time*.4)*.4;
 float w=sin(p.x*1.9+sin(p.y*.65+time*.7)*2.5+time*.65+distort)*.5+.5;
 float fine=sin(p.x*9.+sin(p.y*2.+time)*4.+time*1.2+distort*4.)*.5+.5;
 float ripple=sin(length(p-vec2(0.,-8.))*5.-time*2.)*.5+.5;
 float glint=pow(w,35.)*pow(fine,4.);
 float reflection=exp(-pow((p.x-6.+sin(p.y*.8+time)*.7)/2.8,2.));
 vec3 color=deepColor*1.2+lightColor*(glint*.12+reflection*pow(fine,9.)*.36);
 color+=lightColor*pow(ripple,60.)*.045*exp(-length(p-vec2(0.,-8.))*.025);
 color+=lightColor*step(.997,hash(floor(p*45.)))*glint*(.5+beat*.3);
 float horizon=clamp((-p.y-8.)/130.,0.,1.);color=mix(color,deepColor+lightColor*.13,horizon*.68);
 gl_FragColor=vec4(color,1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}
`;
export const pointVertex = `
uniform float time;uniform float beat;uniform float pointScale;uniform float mode;
attribute float size;attribute float phase;attribute vec3 tint;varying vec3 vColor;varying float vAlpha;
void main(){vec3 p=position;p.x+=sin(time*.22+phase)*.16;p.y+=sin(time*.5+phase)*.12;
 if(mode>1.5){p.y+=mod(time*.3+phase,5.)-2.5;}
 if(mode>.5&&mode<1.5){float a=time*.065;float x=p.x;p.x=x*cos(a)-p.z*sin(a);p.z=x*sin(a)+p.z*cos(a);}
 vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;
 gl_PointSize=clamp(size*pointScale*(220./-mv.z)*(1.+beat*.08),1.,25.);
 vColor=tint;vAlpha=.55+.4*sin(phase+time*.8)*sin(phase+time*.8);}
`;
export const pointFragment = `
varying vec3 vColor;varying float vAlpha;
void main(){float d=length(gl_PointCoord-.5);if(d>.5)discard;float a=exp(-d*d*21.);float core=exp(-d*d*140.);
 gl_FragColor=vec4(vColor*(1.+core*.8),(a*.65+core*.5)*vAlpha);}
`;
export const jellyVertex = `
uniform float time;uniform float phase;uniform float beat;varying vec3 vNormal;varying vec3 vPosition;
void main(){vec3 p=position;float pulse=sin(time*2.+phase);p.xz*=1.+pulse*.09+beat*.018;p.y*=1.-pulse*.055;
 vPosition=(modelViewMatrix*vec4(p,1.)).xyz;vNormal=normalize(normalMatrix*normal);gl_Position=projectionMatrix*vec4(vPosition,1.);}
`;
export const jellyFragment = `
uniform vec3 tint;uniform float time;uniform float phase;varying vec3 vNormal;varying vec3 vPosition;
void main(){vec3 viewDir=normalize(-vPosition);float fres=pow(1.-abs(dot(normalize(vNormal),viewDir)),2.);
 float veins=pow(.5+.5*sin(atan(vNormal.x,vNormal.z)*18.),12.);float wave=.8+.2*sin(time*2.+phase);
 gl_FragColor=vec4(tint*(.5+fres*2.+veins*.35)*wave,.18+fres*.6+veins*.12);}
`;

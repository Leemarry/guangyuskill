import {useMemo} from 'react';
import {ThreeCanvas} from '@remotion/three';
import {useThree} from '@react-three/fiber';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import * as THREE from 'three';
import {skyVertex,skyFragment,waterVertex,waterFragment,pointVertex,pointFragment,jellyVertex,jellyFragment} from './shaders01';
import {cameraPose} from './action01';

export const cuts=[0,117,288,400,552,639,776,924];
const palettes=[
 {top:'#365b83',horizon:'#edc4a4',sun:'#ffe3b6',water:'#465d76',light:'#e9cfc2',night:.1},
 {top:'#030916',horizon:'#152438',sun:'#c0dcf5',water:'#07131e',light:'#6c9db8',night:1},
 {top:'#04152a',horizon:'#183950',sun:'#b1e5ff',water:'#0a2130',light:'#6cbee4',night:1},
 {top:'#223e51',horizon:'#749b9c',sun:'#d6e8d3',water:'#193641',light:'#afded3',night:.6},
 {top:'#1c1e32',horizon:'#725549',sun:'#ffd89b',water:'#2c2a30',light:'#e8b583',night:.75},
 {top:'#38577b',horizon:'#b7c2cf',sun:'#ffe4bb',water:'#465b73',light:'#e2c9bb',night:.1},
 {top:'#4e6577',horizon:'#f8c599',sun:'#ffe9b6',water:'#42576b',light:'#f9d2a3',night:0},
];
const rand=(i:number)=>{const x=Math.sin(i*127.1+311.7)*43758.5453;return x-Math.floor(x);};
const color=(s:string)=>new THREE.Color(s);

function Camera({t}:{t:number}){
 const {camera}=useThree();
 const p=cameraPose(t);
 camera.position.set(p.x,p.y,p.z);
 camera.lookAt(p.lookX,p.lookY,p.lookZ);
 camera.updateMatrixWorld();return null;
}

function Sky({t,scene}:{t:number;scene:number}){
 const p=palettes[scene];
 return <mesh><sphereGeometry args={[160,32,24]}/>
  <shaderMaterial side={THREE.BackSide} vertexShader={skyVertex} fragmentShader={skyFragment}
   uniforms={{topColor:{value:color(p.top)},horizonColor:{value:color(p.horizon)},sunColor:{value:color(p.sun)},time:{value:t},night:{value:p.night}}}/>
 </mesh>;
}

function Ocean({t,scene,beat}:{t:number;scene:number;beat:number}){
 const p=palettes[scene];
 return <mesh rotation={[-Math.PI/2,0,0]} position={[0,-.03,-45]}>
  <planeGeometry args={[300,240,90,90]}/>
  <shaderMaterial vertexShader={waterVertex} fragmentShader={waterFragment} uniforms={{time:{value:t},beat:{value:beat},deepColor:{value:color(p.water)},lightColor:{value:color(p.light)}}}/>
 </mesh>;
}

function Mountains({scene}:{scene:number}){
 const geometry=useMemo(()=>{
  const g=new THREE.PlaneGeometry(250,1,180,1),p=g.attributes.position;
  for(let i=0;i<p.count;i++){
   const x=p.getX(i),h=1+Math.sin(x*.061+2)*1.7+Math.sin(x*.153)*.7+Math.sin(x*.42)*.25;
   p.setY(i,p.getY(i)>0?Math.max(.2,h):-2);
  }g.computeVertexNormals();return g;
 },[]);
 return <group>
  <mesh geometry={geometry} position={[0,.2,-88]} scale={[1,2.2,1]}><meshBasicMaterial color={palettes[scene].top} fog/></mesh>
  <mesh geometry={geometry} position={[-20,.05,-53]} scale={[1,.65,1]}><meshBasicMaterial color={scene===6?'#6f777b':'#152a36'} fog/></mesh>
 </group>;
}

function Particles({t,beat,mode,count=4000}:{t:number;beat:number;mode:number;count?:number}){
 const geo=useMemo(()=>{
  const pos=new Float32Array(count*3),sizes=new Float32Array(count),phase=new Float32Array(count),colors=new Float32Array(count*3);
  const shades=mode===1?['#c6ecff','#7ebfe9','#e5fcff']:mode===2?['#ffd18a','#ffe8c2','#ffa594']:['#c0eec4','#e7dfae','#b0ddd6'];
  for(let i=0;i<count;i++){
   let x,y,z;
   if(mode===1){
    const a=rand(i+12)*Math.PI*2,r=3+rand(i+44)*11,spiral=Math.sin(a*3+r*.9)*.25;
    x=Math.cos(a)*(r+spiral);z=-10+Math.sin(a)*(r+spiral)*.78;y=.32+Math.sin(a*3+r)*.12+rand(i+78)*.28;
    if(i%9===0){y+=rand(i+91)*5;x*=.8;}
   }else if(mode===2){x=(rand(i+12)-.5)*28;y=rand(i+31)*13;z=-25+rand(i+63)*35;}
   else{x=(rand(i+12)-.5)*100;y=rand(i+31)*40+.5;z=-100+rand(i+63)*109;}
   pos.set([x,y,z],i*3);sizes[i]=mode===0?.25+rand(i+11)*.5:.25+rand(i+11)*.85;phase[i]=rand(i+19)*Math.PI*2;
   const c=color(shades[i%3]);colors.set([c.r,c.g,c.b],i*3);
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));g.setAttribute('size',new THREE.BufferAttribute(sizes,1));g.setAttribute('phase',new THREE.BufferAttribute(phase,1));g.setAttribute('tint',new THREE.BufferAttribute(colors,3));return g;
 },[count,mode]);
 return <points geometry={geo} frustumCulled={false}>
  <shaderMaterial vertexShader={pointVertex} fragmentShader={pointFragment} transparent depthWrite={false} blending={THREE.AdditiveBlending}
   uniforms={{time:{value:t},beat:{value:beat},mode:{value:mode},pointScale:{value:mode===0?.19:.26}}}/>
 </points>;
}

function Moon({scene}:{scene:number}){
 const c=palettes[scene].sun;
 return <group position={scene===6?[27,4,-70]:[32,10,-70]}>
  <mesh><sphereGeometry args={[scene===6?2.7:1.65,48,32]}/><meshBasicMaterial color={c}/></mesh>
 </group>;
}

export function Reeds({t}:{t:number}){
 const geo=useMemo(()=>{
  const pts:number[]=[];
  for(let i=0;i<240;i++){
   const x=(rand(i+71)-.5)*42,z=-5-rand(i+18)*22,h=.4+rand(i+8)*1.9,sway=Math.sin(t*1.1+i)*.1;
   pts.push(x,0,z,x+sway,h,z);
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pts,3));return g;
 },[t]);
 const flowers=useMemo(()=>Array.from({length:115},(_,i)=>({x:(rand(i+18)-.5)*40,z:-3-rand(i+41)*24,h:.5+rand(i+2)*1.5,r:.05+rand(i+99)*.07})),[]);
 return <group>
  <mesh rotation={[-Math.PI/2,0,0]} position={[0,.01,-15]}><planeGeometry args={[48,32]}/><meshStandardMaterial color="#284635" roughness={1}/></mesh>
  <lineSegments geometry={geo}><lineBasicMaterial color="#6b9f72" transparent opacity={.8}/></lineSegments>
  {flowers.map((f,i)=><group key={i} position={[f.x+Math.sin(t*1.1+i)*.1,f.h,f.z]} rotation={[0,t*.03+i,.15*Math.sin(t+i)]}>
   <mesh><sphereGeometry args={[f.r,6,4]}/><meshBasicMaterial color={['#e2edac','#9be9d5','#e8b8d1'][i%3]}/></mesh>
   <mesh rotation={[Math.PI/2,0,0]}><torusGeometry args={[f.r*1.6,f.r*.32,3,7]}/><meshBasicMaterial color={i%3===0?'#d6c681':'#8ec7a2'}/></mesh>
  </group>)}
 </group>;
}

function Bird({t,index=0,large=false}:{t:number;index?:number;large?:boolean}){
 const phase=t*3+index,x=Math.sin(t*.26+index*.7)*8+(large?0:index*2-4),z=large?-8:-23-index*3,y=large?4.3:5.5+index*.45;
 const shape=useMemo(()=>{const s=new THREE.Shape();s.moveTo(0,0);s.quadraticCurveTo(.65,.12,1.8,-.08);s.quadraticCurveTo(.8,-.23,0,-.08);return s;},[]);
 return <group position={[x,y+Math.sin(t*.6+index)*.3,z]} rotation={[0,.15*Math.sin(t*.4),.04*Math.sin(t)]} scale={large?1.15:.55}>
  <mesh rotation={[0,0,.4+Math.sin(phase)*.5]}><shapeGeometry args={[shape]}/><meshBasicMaterial color="#d1dfe2" side={THREE.DoubleSide}/></mesh>
  <mesh rotation={[0,Math.PI,-.4-Math.sin(phase)*.5]}><shapeGeometry args={[shape]}/><meshBasicMaterial color="#c6dbe0" side={THREE.DoubleSide}/></mesh>
  <mesh rotation={[0,0,Math.PI/2]} scale={[.12,.5,.12]}><sphereGeometry args={[1,10,8]}/><meshStandardMaterial color="#ecded9"/></mesh>
 </group>;
}

function Jelly({t,beat,position,size,tint,phase}:{t:number;beat:number;position:[number,number,number];size:number;tint:string;phase:number}){
 const bell=useMemo(()=>{
  const pts=[];for(let i=0;i<=28;i++){const a=(i/28)*Math.PI/2;pts.push(new THREE.Vector2(Math.sin(a)*.9,Math.cos(a)*.68));}
  return new THREE.LatheGeometry(pts,56);
 },[]);
 const tentacles=useMemo(()=>{
  const pts:number[]=[];
  for(let j=0;j<18;j++){
   const a=j/18*Math.PI*2;
   for(let k=0;k<42;k++)for(const q of [k,k+1]){
    const f=q/42,l=1.5+rand(j+phase)*1.5,w=Math.sin(f*7-t*1.7+phase+j*.4)*f*.19;
    pts.push(Math.cos(a)*(.72-f*.25)+w,-f*l,Math.sin(a)*(.72-f*.25)+Math.cos(f*8-t+phase)*f*.15);
   }
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pts,3));return g;
 },[t,phase]);
 return <group position={[position[0],position[1]+Math.sin(t*1.6+phase)*.13,position[2]]} scale={size} rotation={[.07*Math.sin(t*.5),t*.04,.04*Math.sin(t+phase)]}>
  <mesh geometry={bell}><shaderMaterial vertexShader={jellyVertex} fragmentShader={jellyFragment} uniforms={{time:{value:t},phase:{value:phase},beat:{value:beat},tint:{value:color(tint)}}} side={THREE.DoubleSide} transparent depthWrite={false} blending={THREE.AdditiveBlending}/></mesh>
  <lineSegments geometry={tentacles}><lineBasicMaterial color={tint} transparent opacity={.62} blending={THREE.AdditiveBlending} depthWrite={false}/></lineSegments>
  <mesh position={[0,.12,0]} rotation={[Math.PI/2,0,t*.2]}><torusGeometry args={[.3,.022,5,40]}/><meshBasicMaterial color={tint} transparent opacity={.9}/></mesh>
  <mesh rotation={[Math.PI/2,0,0]} scale={[1+Math.sin(t*2+phase)*.09,1+Math.sin(t*2+phase)*.09,1]}><torusGeometry args={[.89,.013,5,80]}/><meshBasicMaterial color={tint} transparent opacity={.8}/></mesh>
 </group>;
}

export function Lanterns({t}:{t:number}){
 const lamps=useMemo(()=>Array.from({length:50},(_,i)=>({x:(rand(i+20)-.5)*38,y:rand(i+8)*15,z:-5-rand(i+13)*35,s:.07+rand(i+18)*.16})),[]);
 return <group>{lamps.map((p,i)=><group key={i} position={[p.x+Math.sin(t*.35+i)*.24,(p.y+t*.17)%15,p.z]} scale={p.s} rotation={[.08*Math.sin(t+i),i,.08*Math.cos(t+i)]}>
  <mesh><cylinderGeometry args={[.7,.9,1.5,10,1,true]}/><meshBasicMaterial color={i%3===0?'#ffc49c':'#ffdda3'} side={THREE.DoubleSide} transparent opacity={.72}/></mesh>
  <mesh position={[0,-.4,0]}><sphereGeometry args={[.38,8,6]}/><meshBasicMaterial color="#fff3c9"/></mesh>
 </group>)}</group>;
}

function CloudGround({t,scene}:{t:number;scene:number}){
 const clouds=useMemo(()=>Array.from({length:55},(_,i)=>({x:(rand(i+44)-.5)*64,z:8-rand(i+31)*65,s:1.5+rand(i+66)*4})),[]);
 return <group>{clouds.map((p,i)=><mesh key={i} position={[p.x+Math.sin(t*.08+i)*.14,-.8+Math.sin(i)*.25,p.z]} scale={[p.s,p.s*.33,p.s*.72]}>
  <sphereGeometry args={[1,16,12]}/><meshStandardMaterial color={scene===6?'#f5e1c8':'#d0d5dd'} roughness={1}/>
 </mesh>)}</group>;
}

function Island({scene}:{scene:number}){
 const geo=useMemo(()=>{
  const g=new THREE.PlaneGeometry(45,70,40,55),a=g.attributes.position;
  for(let i=0;i<a.count;i++){
   const x=a.getX(i),z=a.getY(i);
   a.setZ(i,Math.sin(x*.17+z*.12)*.33+Math.sin(z*.21)*.3);
  }g.computeVertexNormals();return g;
 },[]);
 return <mesh geometry={geo} rotation={[-Math.PI/2,0,0]} position={[-8,.1,-23]}>
  <meshStandardMaterial color={scene===1?'#293a52':scene===4?'#766052':'#a5b1bd'} roughness={1}/>
 </mesh>;
}

function PaperBoat({t}:{t:number}){
 const shape=useMemo(()=>{
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute([
   -1,0,0, 0,.52,0, 0,0,.52,  0,.52,0, 1,0,0, 0,0,.52,
   -1,0,0, 0,0,-.52, 0,.52,0,  0,0,-.52,1,0,0,0,.52,0,
   -1,0,0,0,-.3,.2,1,0,0, -1,0,0,1,0,0,0,-.3,-.2,
  ],3));g.computeVertexNormals();return g;
 },[]);
 return <group>
  <group position={[2.8-(t-13)*.13,.22+Math.sin(t*2)*.05,-2.8]} rotation={[.04*Math.sin(t),-.3,.04*Math.sin(t*1.3)]} scale={.9}>
   <mesh geometry={shape}><meshStandardMaterial color="#f4e7ca" side={THREE.DoubleSide} roughness={.8}/></mesh>
  </group>
  <group position={[-1.6,.01,2]}>
   {Array.from({length:15},(_,i)=><mesh key={i} position={[0,.025,-i*.34]}><boxGeometry args={[2.7,.14,.29]}/><meshStandardMaterial color="#6f695b" roughness={1}/></mesh>)}
   {[-1.2,1.2].map(x=>[0,-4.5].map(z=><mesh key={`${x}-${z}`} position={[x,-.2,z]}><cylinderGeometry args={[.07,.09,1.2,8]}/><meshStandardMaterial color="#655b50"/></mesh>))}
  </group>
 </group>;
}

function Fire({t}:{t:number}){
 return <group position={[1.15,.08,.8]}>
  {[0,1,2].map(i=><mesh key={i} position={[Math.sin(i*2)*.15,.1,Math.cos(i*2)*.15]} rotation={[Math.PI/2,0,i*2]}><cylinderGeometry args={[.065,.075,.8,7]}/><meshStandardMaterial color="#4f3d32"/></mesh>)}
  {[0,1,2,3,4].map(i=><mesh key={i} position={[Math.sin(i*3)*.12,.25+(Math.sin(t*8+i)*.5+.5)*.12,Math.cos(i*3)*.08]} scale={[.12,.32+Math.sin(t*6+i)*.08,.1]} rotation={[0,0,Math.sin(t*5+i)*.2]}><octahedronGeometry args={[1,1]}/><meshBasicMaterial color={i%2?'#ffe4a1':'#f6a368'} transparent opacity={.65}/></mesh>)}
  <pointLight color="#ffc88c" intensity={4} distance={6}/>
 </group>;
}

function Rainbow(){
 return <group position={[6,.7,-32]} rotation={[0,-.12,0]}>{['#e8b4b0','#ebc49a','#ead9ae','#aecbbb','#a4bacf','#b5abc9'].map((c,i)=><mesh key={c}>
  <torusGeometry args={[12-i*.22,.11,6,100,Math.PI]}/><meshBasicMaterial color={c} transparent opacity={.4} depthWrite={false}/>
 </mesh>)}</group>;
}

function Foreground({scene}:{scene:number}){
 const geo=useMemo(()=>{
  const g=new THREE.PlaneGeometry(1,1,35,35),p=g.attributes.position;
  for(let i=0;i<p.count;i++){
   const u=p.getX(i)+.5,v=p.getY(i)+.5,z=8-v*30;
   const edge=1.5+Math.sin(v*7)*1.2-v*1.4;
   const x=-22+u*(22+edge);
   p.setXYZ(i,x,.11+Math.sin(x*.2+z*.14)*.025,z);
  }g.computeVertexNormals();return g;
 },[]);
 if(scene===3)return null;
 const shade=['#c4b6a2','#23334a','#284456','#9aa59c','#66594e','#9caeb9','#d3c4a8'][scene];
 return <mesh geometry={geo}><meshStandardMaterial color={shade} side={THREE.DoubleSide} roughness={1}/></mesh>;
}

function WorldScene({frame,scene,beat}:{frame:number;scene:number;beat:number}){
 const t=frame/30,p=palettes[scene];
 return <>
  <Camera t={t}/><fog attach="fog" args={[p.horizon,35,150]}/>
  <ambientLight intensity={.8} color="#cad9e4"/><directionalLight position={[10,10,-10]} intensity={2.4} color={p.sun}/>
  <Sky t={t} scene={scene}/>{scene!==1&&scene!==4&&scene!==5&&<Ocean t={t} scene={scene} beat={beat}/>}<Mountains scene={scene}/>
  <Foreground scene={scene}/>
  {(scene===0||scene===6)&&<Moon scene={scene}/>}
  <Particles t={t} beat={beat} mode={0} count={scene===2?1400:scene===1?200:320}/>
  {(scene===0||scene===6)&&<CloudGround t={t} scene={scene}/>}
  {(scene===1||scene===4||scene===5)&&<Island scene={scene}/>}
  {(scene===0||scene===5||scene===6)&&<><Bird t={t} index={0}/><Bird t={t} index={1}/><Bird t={t} index={2}/></>}
  {scene===2&&<>
   <Particles t={t} beat={beat} mode={1} count={14500}/>
   <Jelly t={t} beat={beat} position={[5.5,3.7,-17]} size={.43} tint="#98d9ff" phase={0}/>
   <Jelly t={t} beat={beat} position={[9,4.5,-23]} size={.38} tint="#9df3ed" phase={2}/>
   <Jelly t={t} beat={beat} position={[12,3.4,-29]} size={.32} tint="#b6caff" phase={4}/>
  </>}
  {scene===3&&<PaperBoat t={t}/>}
  {scene===4&&<><Fire t={t}/><Particles t={t} beat={beat} mode={2} count={280}/></>}
  {scene===5&&<Rainbow/>}
 </>;
}

/**
 * 3D 世界（01 版）：七套色板 + 着色器天空/海面/粒子 + 云海/岛/纸船/火堆/彩虹。
 *
 * 和 2D 的 Relay01 是两种做法，不是替代关系：
 *   Relay01  —— 零额外依赖，靠"接力"把几幅 2D 地貌连起来，适合 5–8 秒一段的长镜头
 *   World01  —— 需要 three / @react-three/fiber，自带景深与体积感，适合卡点、快节奏
 *
 * beat 由调用方传入（用 scripts/beatmap.py 生成的低频能量曲线），
 * 本组件不自己读 json —— 数据来源由调用方决定，才好在不同片子里换曲子。
 */
export function World({fixedFrame,sceneOverride,frameOffset=0,beat=0}:{fixedFrame?:number;sceneOverride?:number;frameOffset?:number;beat?:number}){
 const current=useCurrentFrame(),{width,height}=useVideoConfig(),frame=fixedFrame??current+frameOffset;
 const scene=sceneOverride??Math.min(6,cuts.findIndex((x,i)=>i>0&&frame<x)-1);
 return <ThreeCanvas width={width} height={height} camera={{fov:48,near:.1,far:240,position:[0,4,14]}}
  gl={{antialias:true,alpha:false,preserveDrawingBuffer:true,powerPreference:'high-performance'}} dpr={1}>
  <WorldScene key={scene} frame={frame} scene={Math.max(0,scene)} beat={beat}/>
 </ThreeCanvas>;
}

export {WorldScene};

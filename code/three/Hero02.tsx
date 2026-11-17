import {useLayoutEffect,useMemo,useRef} from 'react';
import {ThreeCanvas} from '@remotion/three';
import {useThree} from '@react-three/fiber';
import {interpolate,useCurrentFrame,useVideoConfig} from 'remotion';
import * as THREE from 'three';
import {cameraPose,groundHeight,heroAction,smooth} from './action01';

function Cape({t,tint='#d59067'}:{t:number;tint?:string}){
 const geo=useMemo(()=>{
  const g=new THREE.PlaneGeometry(1,1,32,28),p=g.attributes.position;
  for(let i=0;i<p.count;i++){
   const u=p.getX(i)+.5,v=.5-p.getY(i);
   const width=.42+Math.sin(v*Math.PI*.5)*1.5;
   const x=(u-.5)*width;
   const flutter=Math.sin(v*6+u*5-t*3)*v*.08;
   p.setXYZ(i,x,1.95-v*1.35,.18+v*.25+Math.pow(Math.abs(u-.5)*2,2)*.18+flutter);
  }g.computeVertexNormals();return g;
 },[t]);
 const seam=useMemo(()=>{
  const pts=[];for(let i=0;i<=60;i++){
   const u=i/60,x=(u-.5)*1.92,v=1;
   pts.push(new THREE.Vector3(x,.6,.18+v*.25+Math.pow(Math.abs(u-.5)*2,2)*.18+Math.sin(v*6+u*5-t*3)*v*.08));
  }return new THREE.BufferGeometry().setFromPoints(pts);
 },[t]);
 return <group>
  <mesh geometry={geo}><meshStandardMaterial color={tint} roughness={.82} side={THREE.DoubleSide}/></mesh>
  <primitive object={new THREE.Line(seam,new THREE.LineBasicMaterial({color:'#ffdeb1'}))}/>
  <mesh position={[0,1.86,.2]} rotation={[Math.PI/2,0,0]}><torusGeometry args={[.22,.045,8,32]}/><meshStandardMaterial color="#e4b99c"/></mesh>
 </group>;
}

function companionPosition(t:number,id:number){
 const options={extrapolateLeft:'clamp' as const,extrapolateRight:'clamp' as const};
 return id===1?{
  x:interpolate(t,[8.5,10.5,13,23,27,30.8],[-4.8,-2.7,-2.4,-3.8,-2.2,-1.6],options),
  z:interpolate(t,[8.5,10.5,13,23,30.8],[-12,-7,-6,-9,-10],options)
 }:{
  x:interpolate(t,[13,15.2,18,23,30.8],[-2.6,-2,-1.9,-4.3,-3.9],options),
  z:interpolate(t,[13,15.2,18,23,30.8],[-7,-3,-3,-7,-9],options)
 };
}

function TravelerModel({t,tint='#d59067',companion=0}:{t:number;tint?:string;companion?:number}){
 const root=useRef<THREE.Group>(null);
 const action=heroAction(t);
 const reach=companion?0:action.reach;
 const position=companion?companionPosition(t,companion):action;
 const ahead=companionPosition(t+.04,companion),behind=companionPosition(t-.04,companion);
 const walk=companion?Math.min(1,Math.hypot(ahead.x-behind.x,ahead.z-behind.z)/.08/.55):action.walk;
 const step=Math.sin(action.phase+companion)*.48*walk;
 const crouch=companion?0:action.crouch;
 const {x,z}=position;
 const opacity=companion===1?Math.max(smooth(8.5,9.3,t)*(1-smooth(12.5,13.5,t)),smooth(23,24.2,t)):companion===2?Math.max(smooth(13.5,14.5,t)*(1-smooth(17.7,18.5,t)),smooth(24,25,t)):1;
 const size=companion===1?.8:companion===2?.72:1;
 const yaw=companion?-.24:action.yaw;
 useLayoutEffect(()=>{
  root.current?.traverse(object=>{
   if(!('material' in object))return;
   const materials=(object as THREE.Mesh).material;
   for(const material of Array.isArray(materials)?materials:[materials]){
    material.userData.baseOpacity??=material.opacity;
    material.opacity=material.userData.baseOpacity*opacity;
    material.transparent=material.opacity<1;
   }
  });
 },[opacity]);
 const robe=useMemo(()=>new THREE.LatheGeometry([
  new THREE.Vector2(.34,.42),new THREE.Vector2(.33,.7),new THREE.Vector2(.26,1.15),new THREE.Vector2(.22,1.6),new THREE.Vector2(.31,1.8)
 ],32),[]);
 if(opacity<=0)return null;
 return <group ref={root} position={[x,groundHeight(x,z,t)+.04,z]} scale={size}>
  <mesh rotation={[-Math.PI/2,0,0]} position={[0,.004,0]} scale={[.42,.29,1]}><circleGeometry args={[1,32]}/><meshBasicMaterial color="#111a24" transparent opacity={.23*opacity} depthWrite={false}/></mesh>
  <group rotation={[0,yaw,0]} position={[0,Math.abs(Math.sin(action.phase))*.025*walk-crouch*.18,0]}>
  <group rotation={[-crouch*.42,0,0]} position={[0,0,-crouch*.08]}>
  <mesh geometry={robe}><meshStandardMaterial color="#eee4d0" roughness={1}/></mesh>
  {[-1,1].map(side=><group key={side} position={[side*.15,.48,0]} rotation={[side*step-crouch*1.25,0,0]}>
   <mesh position={[0,-.11,0]}><capsuleGeometry args={[.09,.12,5,12]}/><meshStandardMaterial color="#eee3ce"/></mesh>
   <group position={[0,-.22,0]} rotation={[crouch*1.8,0,0]}>
    <mesh position={[0,-.1,0]}><capsuleGeometry args={[.08,.12,5,12]}/><meshStandardMaterial color="#eee3ce"/></mesh>
    <mesh position={[0,-.23,-.06]} scale={[.11,.07,.18]}><sphereGeometry args={[1,16,10]}/><meshStandardMaterial color="#554c50"/></mesh>
   </group>
  </group>)}
  <Cape t={t} tint={tint}/>
  <group position={[-.29,1.65,0]} rotation={[step*.5+crouch*.9,0,-.13]}><mesh position={[0,-.27,0]}><capsuleGeometry args={[.085,.4,5,12]}/><meshStandardMaterial color="#eee4d0"/></mesh></group>
  <group position={[.29,1.65,-.04]} rotation={[-step*.5+crouch*1.15,0,.16+reach*2.1]}><mesh position={[0,-.25,0]}><capsuleGeometry args={[.085,.36,5,12]}/><meshStandardMaterial color="#eee4d0"/></mesh><mesh position={[0,-.49,0]}><sphereGeometry args={[.085,12,8]}/><meshStandardMaterial color="#e7d4bb"/></mesh></group>
  <group rotation={[companion?0:action.headTilt,0,0]} position={[0,1.9,0]}>
  <group position={[0,-1.9,0]}>
  <mesh position={[0,1.92,-.06]} scale={[.25,.29,.24]}><sphereGeometry args={[1,32,24]}/><meshStandardMaterial color="#ece8de" roughness={.9}/></mesh>
  <mesh position={[0,1.94,-.235]} scale={[.195,.19,.09]}><sphereGeometry args={[1,32,24]}/><meshStandardMaterial color="#34393d" roughness={.7}/></mesh>
  <mesh position={[-.075,1.97,-.315]} scale={[.028,.04,.012]}><sphereGeometry args={[1,16,12]}/><meshBasicMaterial color="#fff6d3"/></mesh>
  <mesh position={[.075,1.97,-.315]} scale={[.028,.04,.012]}><sphereGeometry args={[1,16,12]}/><meshBasicMaterial color="#fff6d3"/></mesh>
  {Array.from({length:7},(_,i)=><mesh key={i} position={[(i-3)*.055,2.15+Math.sin(i*1.2)*.025,-.07+(i%2)*.06]} rotation={[.1,0,(i-3)*.15]} scale={[.075,.12,.1]}><sphereGeometry args={[1,12,8]}/><meshStandardMaterial color="#f1eee2"/></mesh>)}
  </group></group>
  <mesh position={[0,1.63,-.28]}><sphereGeometry args={[.055,12,10]}/><meshBasicMaterial color="#ffe3ad"/></mesh>
  </group></group>
 </group>;
}

const petals=new THREE.Shape();petals.moveTo(0,0);petals.bezierCurveTo(.15,.28,.5,.3,.32,.04);petals.bezierCurveTo(.5,-.1,.15,-.16,0,0);

function Butterflies({t}:{t:number}){
 const alpha=smooth(0,.7,t)*(1-smooth(3.2,4.2,t));
 if(alpha<=0)return null;
 const action=heroAction(t);
 return <group position={[action.x+1,0,action.z-1]}>{Array.from({length:8},(_,i)=>{
  const x=-.4+Math.sin(t*.4+i*1.7)*1.6,y=.9+(i%5)*.37+Math.sin(t*.8+i)*.17,z=1.8-(i%4)*.55;
  return <group key={i} position={[x,y,z]} rotation={[.1,t*.3+i,.3*Math.sin(t+i)]} scale={i===0?.65:.28}>
   <mesh rotation={[0,Math.sin(t*14+i)*.9,0]}><shapeGeometry args={[petals]}/><meshBasicMaterial color={i%3===0?'#fff3b0':'#a9efd7'} side={THREE.DoubleSide} transparent opacity={alpha}/></mesh>
   <mesh rotation={[0,Math.PI-Math.sin(t*14+i)*.9,0]}><shapeGeometry args={[petals]}/><meshBasicMaterial color={i%3===0?'#fff3b0':'#a9efd7'} side={THREE.DoubleSide} transparent opacity={alpha}/></mesh>
  </group>;
 })}</group>;
}

function Dandelions({t}:{t:number}){
 const alpha=smooth(4.2,5.5,t)*(1-smooth(8.6,9.7,t));
 const g=useMemo(()=>{
  const pts:number[]=[];
  for(let j=0;j<32;j++){
   const a=j/32*Math.PI*2,dy=Math.cos(j*2.4)*.16;
   pts.push(0,0,0,Math.cos(a)*.16,.2+dy,Math.sin(a)*.16);
  }return new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(pts,3));
 },[]);
 if(alpha<=0)return null;
 return <group>{Array.from({length:42},(_,i)=>{
  const elapsed=Math.max(0,t-4.2),x=-3+(i%9)*.7+elapsed*.35,y=.7+Math.floor(i/9)*.48+Math.sin(t*.4+i)*.2,z=2-(i%7)*.9;
  return <group key={i} position={[x,y,z]} rotation={[t*.3+i,t*.15+i,Math.sin(t+i)*.25]} scale={.35+i%3*.12}>
   <lineSegments geometry={g}><lineBasicMaterial color="#fff9e9" transparent opacity={alpha*.9}/></lineSegments>
   <mesh position={[0,-.08,0]}><cylinderGeometry args={[.008,.004,.16,5]}/><meshBasicMaterial color="#c8bca6" transparent opacity={alpha}/></mesh>
  </group>;
 })}</group>;
}

function Kite({t}:{t:number}){
 const alpha=smooth(25.2,26.8,t);
 const shape=useMemo(()=>{const s=new THREE.Shape();s.moveTo(0,.9);s.lineTo(.55,.2);s.lineTo(0,-.65);s.lineTo(-.55,.2);s.closePath();return s;},[]);
 const action=heroAction(t);
 const hand=new THREE.Vector3(action.x+.42,groundHeight(action.x,action.z,t)+1.8,action.z);
 const end=new THREE.Vector3(2.25+Math.sin(t)*.1,4,-5.3);
 const line=useMemo(()=>new THREE.BufferGeometry().setFromPoints(Array.from({length:40},(_,i)=>{
  const f=i/39;return hand.clone().lerp(end,f).add(new THREE.Vector3(0,-Math.sin(f*Math.PI)*.32,0));
 })),[t]);
 if(alpha<=0)return null;
 return <group>
  <primitive object={new THREE.Line(line,new THREE.LineBasicMaterial({color:'#e8d8c2',transparent:true,opacity:alpha*.65}))}/>
  <group position={[2.25+Math.sin(t)*.1,4.65,-5.3]} rotation={[0,-.1,Math.sin(t*.7)*.15]}>
   <mesh><shapeGeometry args={[shape]}/><meshStandardMaterial color="#dca076" side={THREE.DoubleSide} transparent opacity={alpha}/></mesh>
   <mesh position={[0,.18,.01]} scale={[.018,.73,.01]}><boxGeometry/><meshBasicMaterial color="#f9dba5" transparent opacity={alpha}/></mesh>
   <mesh position={[0,.18,.01]} scale={[1.07,.018,.01]}><boxGeometry/><meshBasicMaterial color="#f9dba5" transparent opacity={alpha}/></mesh>
   {Array.from({length:5},(_,i)=><mesh key={i} position={[Math.sin(t*2+i)*.09,-.8-i*.23,0]} rotation={[0,0,Math.sin(t*2+i)*.25]} scale={[.13,.08,.01]}><octahedronGeometry args={[1,0]}/><meshBasicMaterial color={i%2?'#f2d9aa':'#d79573'} transparent opacity={alpha}/></mesh>)}
  </group>
 </group>;
}

function ActorCamera({t}:{t:number}){const {camera}=useThree();const p=cameraPose(t);camera.position.set(p.x,p.y,p.z);camera.lookAt(p.lookX,p.lookY,p.lookZ);camera.updateMatrixWorld();return null;}

/**
 * 人物 02：3D 旅人（three + @react-three/fiber）。
 *
 * 和 Hero01（2D 斗篷小人）是两套做法：
 *   Hero01 —— 纯 SVG，零额外依赖，一个 pose 就画一个人，30 秒片子渲染只要几秒
 *   Hero02 —— 真 3D，有厚度、有景深、斗篷逐顶点飘动，代价是依赖 three（约 40MB）与更慢的渲染
 *
 * 造型要点：LatheGeometry 的袍身、逐顶点扰动的斗篷、头顶七簇呆毛、
 * 脚下椭圆接触阴影 —— 少任何一个都会从"旅人"退化成"胶囊"。
 *
 * 全片只有一个实例。同行者用 companion=1/2 复用同一模型，只换取色与路线，
 * 不新建第二套几何 —— 这是"同一个人贯穿"在 3D 里的写法。
 */
export function Hero02(){
 const frame=useCurrentFrame(),{width,height,fps}=useVideoConfig(),t=frame/fps;
 return <ThreeCanvas width={width} height={height} camera={{fov:48,near:.1,far:80,position:[0,2.9,9]}} gl={{alpha:true,antialias:true,preserveDrawingBuffer:true}} dpr={1}>
  <ActorCamera t={t}/><ambientLight intensity={1.8} color="#e9e4de"/><directionalLight intensity={3} position={[-3,7,5]} color="#fff1d3"/>
  <TravelerModel t={t}/><TravelerModel t={t} tint="#74aeb6" companion={1}/><TravelerModel t={t} tint="#bc9ea8" companion={2}/><Butterflies t={t}/><Dandelions t={t}/><Kite t={t}/>
 </ThreeCanvas>;
}

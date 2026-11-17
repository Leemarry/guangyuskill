import {Easing,interpolate} from 'remotion';

export const smooth=(a:number,b:number,x:number)=>{
 const v=Math.max(0,Math.min(1,(x-a)/(b-a)));
 return v*v*(3-2*v);
};
const times=[0,1.3,2.5,3.5,5.8,7.2,8.6,9.5,10.3,12.5,13.5,15.2,16.2,17.7,18.6,19.2,20.5,21.3,22.8,24.1,25.5,26.3,28.5,30.8];
const xs=[-3.2,-2.7,-2.2,-1.8,-.6,.2,-.5,-1.1,-.8,-.8,-1.2,-1.1,-.9,-1.1,-.4,.15,.15,.25,.5,.7,.6,.45,.2,-.2];
const zs=[2,1.4,.8,.6,-1.3,-2.8,-3.6,-3.6,-3.6,-3.6,-2,-1.1,-1.1,-1.1,.9,1.2,1.2,.5,-.5,-2,-3.2,-4.1,-4.8,-5.3];
const sample=(t:number,values:number[])=>interpolate(t,times,values,{extrapolateLeft:'clamp',extrapolateRight:'clamp',easing:Easing.inOut(Easing.cubic)});

export function heroAction(t:number){
 const x=sample(t,xs),z=sample(t,zs);
 const dx=sample(Math.min(30.8,t+.04),xs)-sample(Math.max(0,t-.04),xs);
 const dz=sample(Math.min(30.8,t+.04),zs)-sample(Math.max(0,t-.04),zs);
 const speed=Math.hypot(dx,dz)/.08;
 const pointing=smooth(9.45,10.35,t)*(1-smooth(12.2,13,t));
 const crouch=smooth(18.6,19.3,t)*(1-smooth(20.25,21,t));
 const butterfly=smooth(.7,1.5,t)*(1-smooth(2.4,3.15,t));
 const boat=smooth(15,15.8,t)*(1-smooth(17.2,17.9,t));
 const kite=smooth(26,27.1,t);
 const yaw=sample(t,[-.95,-.95,-.95,-.7,-.7,.7,.7,-.35,-.35,-.35,-3,-1.2,-1.2,-2.8,-2.8,-1.2,-1.2,-.9,-.9,-.7,-.3,.6,.6,.6]);
 return {x,z,speed,walk:Math.min(1,speed/.55),yaw,pointing,crouch,
  reach:Math.max(pointing,butterfly*.65,boat*.55,kite*.6),
  headTilt:-.2*pointing-.14*kite,
  phase:t*6.2};
}

export function groundHeight(x:number,z:number,t:number){
 const foreground=.11+Math.sin(x*.2+z*.14)*.025;
 const localX=x+8,localZ=-z-23;
 const island=.1+Math.sin(localX*.17+localZ*.12)*.33+Math.sin(localZ*.21)*.3;
 const night=smooth(3.4,4.4,t)*(1-smooth(9.1,10.1,t));
 const dunes=smooth(17.9,18.9,t)*(1-smooth(25.4,26.4,t));
 const port=smooth(12.83,13.83,t)*(1-smooth(17.9,18.9,t));
 const hill=Math.max(foreground,island);
 return foreground+(hill-foreground)*Math.max(night,dunes)+(0.105-foreground)*port;
}

export function cameraPose(t:number){
 const pan=smooth(20.7,25.2,t)*.45;
 return {x:pan,y:2.9+smooth(26,30.8,t)*.5,z:9,lookX:pan*.3,lookY:1.4+smooth(26,30.8,t)*.6,lookZ:-8};
}

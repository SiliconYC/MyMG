import React, {useEffect, useMemo} from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import * as THREE from 'three';
import {buildScene, smooth, modelTime, cameraAt, type Primitive} from './mustard03-model';

/** The Python original paints projected polygons with Pillow. Here the same
 * world-space XYZ shapes are triangulated every frame by TypeScript and drawn
 * by the live Three.js WebGL context. No prerecorded media inputs of any kind.
 * 1280x720 and 30 FPS / 345 frames are authored in the single project catalog. */
const VERTEX_SHADER=`
attribute vec4 tint;
attribute float worldMode;
attribute vec4 shadowCorners01;
attribute vec4 shadowCorners23;
attribute float shadowRadius;
uniform vec4 cameraX;
uniform float cameraY;
varying vec4 vTint;
varying vec2 vPixel;
varying vec4 vShadow01;
varying vec4 vShadow23;
varying float vShadowRadius;
void main() {
  vTint = tint;
  vShadow01 = shadowCorners01;
  vShadow23 = shadowCorners23;
  vShadowRadius = shadowRadius;
  float rx = position.x - cameraX.y;
  float ry = position.y - cameraX.z;
  vec2 projected = vec2(cameraX.w + cameraX.x * (rx-ry),
    cameraY + .5 * cameraX.x * (rx+ry) - cameraX.x * position.z);
  vec2 pixel = worldMode > .5 ? projected : position.xy;
  vPixel = pixel;
  gl_Position = vec4(pixel.x/640.0-1.0,1.0-pixel.y/360.0,0.0,1.0);
}
`;
const FRAGMENT_SHADER=`
precision highp float;
varying vec4 vTint;
varying vec2 vPixel;
varying vec4 vShadow01;
varying vec4 vShadow23;
varying float vShadowRadius;

// Convolution of a convex edge with a Gaussian: normal CDF approximation.
// Product of four edge coverages approximates Pillow's GaussianBlur polygon.
float edgeCoverage(vec2 a, vec2 b, vec2 center, vec2 pixel, float sigma) {
  vec2 e = b - a;
  float lengthE = max(length(e), 0.001);
  float centerDist = (e.x*(center.y-a.y)-e.y*(center.x-a.x))/lengthE;
  float dist = (e.x*(pixel.y-a.y)-e.y*(pixel.x-a.x))/lengthE;
  dist *= centerDist >= 0.0 ? 1.0 : -1.0;
  return 1.0/(1.0+exp(-1.702*dist/max(sigma,0.2)));
}
void main() {
  float opacity = vTint.a;
  if (vShadowRadius > 0.0) {
    vec2 a=vShadow01.xy,b=vShadow01.zw;
    vec2 c=vShadow23.xy,d=vShadow23.zw;
    vec2 center=(a+b+c+d)*0.25;
    opacity *= edgeCoverage(a,b,center,vPixel,vShadowRadius)
      * edgeCoverage(b,c,center,vPixel,vShadowRadius)
      * edgeCoverage(c,d,center,vPixel,vShadowRadius)
      * edgeCoverage(d,a,center,vPixel,vShadowRadius);
  }
  gl_FragColor=vec4(vTint.rgb, opacity);
}
`;

const hexRGBA=(hex:string,a:number):[number,number,number,number]=>{
  return [parseInt(hex.slice(1,3),16)/255,parseInt(hex.slice(3,5),16)/255,
    parseInt(hex.slice(5,7),16)/255,a];
};

function makeTriangles(scene:Primitive[]):THREE.BufferGeometry{
  const vertices:number[]=[],tints:number[]=[], modes:number[]=[];
  const shadow01:number[]=[],shadow23:number[]=[],radii:number[]=[];
  // Preserve Python order: backmost interposer, bodies sorted by world depth,
  // and then each box's x+ face, y+ face, top, edges and contacts.
  for(const prim of scene){
    if(prim.points.length<3)continue;
    const points=prim.points.map(([x,y])=>new THREE.Vector2(x,y));
    // ShapeUtils expects winding; it flips as needed, including notched dies.
    const tris=THREE.ShapeUtils.triangulateShape(points,[]);
    const rgba=hexRGBA(prim.color,prim.opacity);
    for(const tri of tris){
      for(const index of tri){
        const p=points[index];
        const world=prim.world?.[index];
        vertices.push(...(world??[p.x,p.y,0]));
        modes.push(world?1:0);
        const corners=prim.shadow?.corners;
        shadow01.push(...(corners?[...corners[0],...corners[1]]:[0,0,0,0]));
        shadow23.push(...(corners?[...corners[2],...corners[3]]:[0,0,0,0]));
        radii.push(prim.shadow?.radius??0);
        tints.push(...rgba);
      }
    }
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  geo.setAttribute('tint',new THREE.Float32BufferAttribute(tints,4));
  geo.setAttribute('worldMode',new THREE.Float32BufferAttribute(modes,1));
  geo.setAttribute('shadowCorners01',new THREE.Float32BufferAttribute(shadow01,4));
  geo.setAttribute('shadowCorners23',new THREE.Float32BufferAttribute(shadow23,4));
  geo.setAttribute('shadowRadius',new THREE.Float32BufferAttribute(radii,1));
  return geo;
}

const World:React.FC<{frame:number}> = ({frame})=>{
  const geometry=useMemo(()=>makeTriangles(buildScene(frame)),[frame]);
  const camera=cameraAt(modelTime(frame/30),modelTime(frame/30)>=8.25);
  const material=useMemo(()=>new THREE.ShaderMaterial({
    uniforms:{cameraX:{value:new THREE.Vector4()},cameraY:{value:0}},
    vertexShader:VERTEX_SHADER,fragmentShader:FRAGMENT_SHADER,
    depthTest:false,depthWrite:false,transparent:true,side:THREE.DoubleSide,
    blending:THREE.NormalBlending,
  }),[]);
  material.uniforms.cameraX.value.set(camera.s,camera.tx,camera.ty,camera.ax);
  material.uniforms.cameraY.value=camera.ay;
  useEffect(()=>()=>geometry.dispose(),[geometry]);
  useEffect(()=>()=>material.dispose(),[material]);
  return <mesh geometry={geometry} material={material} frustumCulled={false}/>;
};

const TITLES=[
  {term:'HBM',title:'高带宽存储器',sub:'把内存芯片垂直堆叠'},
  {term:'DRAM',title:'芯片，逐层堆叠',sub:'由单片变成多层结构'},
  {term:'TSV',title:'垂直通孔，连接各层',sub:'细看晶片内部的铜连接'},
  {term:'GPU',title:'八组 HBM，环绕核心',sub:'共同构成高速存储封装'},
] as const;
const BOUNDS=[0,2.25,4.85,7.45,11.50];
const Captions:React.FC<{frame:number}>=({frame})=>{
  const t=frame/30;
  const stage=t<2.25?0:t<4.85?1:t<7.45?2:3;
  const start=BOUNDS[stage],end=BOUNDS[stage+1];
  const data=TITLES[stage];
  let alpha=smooth((t-start+.015)/.18);
  if(stage<3)alpha*=1-smooth((t-(end-.17))/.17);
  else alpha*=smooth((t-8.70)/.24);
  return <div aria-hidden="true" style={{
    position:'absolute',inset:0,pointerEvents:'none',overflow:'hidden',
    fontFamily:'"Noto Sans CJK SC","Noto Sans SC","Microsoft YaHei","PingFang SC",system-ui,sans-serif',
    color:'#262c30',
  }}>
    {stage>=2&&<div style={{
      position:'absolute',top:36,left:48,width:stage===2?532:437,height:151,
      background:`rgba(246,242,234,${178/255*alpha})`,borderRadius:13
    }}/>}
    <div style={{position:'absolute',top:61,left:68,opacity:alpha}}>
      <div style={{fontSize:25,lineHeight:'31px',fontFamily:'Inter,Arial,sans-serif',fontWeight:600,color:'#ab4135',letterSpacing:0}}>{data.term}</div>
      <div style={{marginTop:3,fontSize:39,lineHeight:'49px',fontWeight:700,whiteSpace:'nowrap'}}>{data.title}</div>
      <div style={{marginTop:8,fontSize:21,lineHeight:'27px',color:'#656867',whiteSpace:'nowrap'}}>{data.sub}</div>
    </div>
    {stage===3&&t>10.35&&<div style={{
      position:'absolute',left:70,bottom:21,fontSize:17,color:'#656867',
      opacity:.71*smooth((t-10.35)/.25)
    }}>布局参考 B200 · 存储堆叠层数为示意</div>}
  </div>;
};
export const HbmMustard03Native:React.FC=()=>{
  const frame=useCurrentFrame();
  return <AbsoluteFill data-testid="hbm-native-scene" data-renderer="react-threejs-webgl"
    style={{background:'linear-gradient(to bottom,#f4f0e7,#e8e2d9)',overflow:'hidden'}}>
    <ThreeCanvas orthographic width={1280} height={720}
      camera={{position:[0,0,10],zoom:1,near:.1,far:1000}}
      gl={{alpha:true,antialias:true,preserveDrawingBuffer:true}}
      style={{position:'absolute',inset:0,width:1280,height:720,background:'transparent'}}>
      <World frame={frame}/>
    </ThreeCanvas>
    <Captions frame={frame}/>
  </AbsoluteFill>;
};

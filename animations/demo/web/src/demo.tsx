import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';

// A standalone non-HBM project. No new portal, Player, or Studio required.
export const DemoScene: React.FC = () => {
  const frame=useCurrentFrame();
  const progress=Math.min(1,Math.max(0,frame/75));
  const ease=progress*progress*(3-2*progress);
  return <AbsoluteFill style={{background:'#F1EEE8',color:'#1E3442',overflow:'hidden'}}>
    <div style={{position:'absolute',top:124,left:120,fontSize:22,letterSpacing:4}}>MYMG / DEMO</div>
    <h1 style={{position:'absolute',top:158,left:115,fontSize:72,margin:0}}>帧驱动的动画</h1>
    <div data-testid="demo-moving-disc" style={{position:'absolute',left:152+ease*660,
      top:385,width:122,height:122,borderRadius:'50%',background:'#D8774B',
      boxShadow:'22px 20px 0 #8EABB4'}} />
    <div style={{position:'absolute',left:120,bottom:102,width:1000,height:17,
      background:'#D2D9D7',borderRadius:8}}>
      <div style={{width:(ease*100)+'%',height:'100%',background:'#D8774B',borderRadius:8}}/>
    </div>
    <span style={{position:'absolute',bottom:55,right:120,fontSize:24}}>FRAME {frame}</span>
  </AbsoluteFill>;
};

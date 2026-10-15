import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {easeOutCubic, TitlePanel} from '@mymg/mg';

// 2D smoke test that can be rendered without WebGL.
export const SystemCheck: React.FC = () => {
  const frame = useCurrentFrame();
  const progress = easeOutCubic(frame / 35);
  return (
    <AbsoluteFill style={{backgroundColor: '#F2EEE7', color: '#222F37'}}>
      <TitlePanel eyebrow="MYMG / SYSTEM" title="公共工作室测试"
        subtitle="同一套时间轴、渲染器与版式组件" />
      <div style={{position: 'absolute', left: 150, right: 150,
        top: 380, height: 20, background: '#D3D9D8', borderRadius: 10}}>
        <div style={{width: (progress * 100) + '%', height: 20,
          background: '#A83E33', borderRadius: 10}} />
      </div>
    </AbsoluteFill>
  );
};

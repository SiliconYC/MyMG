import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {OrthographicStage, TitlePanel, arrival} from '@mymg/mg';

// Smoke test only: not the next Mustard animation and not a precise B200 model.
export const HbmInfrastructureCheck: React.FC = () => {
  const frame = useCurrentFrame();
  const hbmX = 2.5;
  const gpuX = -2.7;
  return (
    <AbsoluteFill style={{backgroundColor: '#F1EEE8'}}>
      <OrthographicStage zoom={78}>
        <mesh position={[0, -0.36, 0]}>
          <boxGeometry args={[12, 0.4, 5.4]} />
          <meshStandardMaterial color="#4E6771" metalness={0.25} roughness={0.55} />
        </mesh>
        <mesh position={[gpuX, 0.28, 0]}>
          <boxGeometry args={[3.2, 0.86, 3.4]} />
          <meshStandardMaterial color="#4A6174" metalness={0.28} roughness={0.48} />
        </mesh>
        <mesh position={[hbmX, 0.12, 0]}>
          <boxGeometry args={[2.7, 0.33, 2.6]} />
          <meshStandardMaterial color="#B89B6C" metalness={0.35} roughness={0.42} />
        </mesh>
        {Array.from({length: 4}, (_, index) => {
          const start = 24 + index * (16 - index * 2);
          const progress = arrival(frame, start, 14);
          return (
            <mesh key={index} visible={frame >= start}
              position={[hbmX, 0.38 + index * 0.25 + (1-progress) * 1.7, 0]}>
              <boxGeometry args={[2.65, 0.18, 2.55]} />
              <meshStandardMaterial color="#AABCBF" metalness={0.3} roughness={0.42} />
            </mesh>
          );
        })}
      </OrthographicStage>
      <TitlePanel eyebrow="HBM / 技术验证" title="共用三维工作台"
        subtitle="固定正交摄影机 · 确定性逐帧堆叠" />
    </AbsoluteFill>
  );
};

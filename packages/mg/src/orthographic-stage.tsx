import React, {useLayoutEffect} from 'react';
import {ThreeCanvas} from '@remotion/three';
import {useThree} from '@react-three/fiber';
import {useVideoConfig} from 'remotion';

type Props = {
  children: React.ReactNode;
  zoom?: number;
  position?: [number, number, number];
  background?: string;
};

const AimAtOrigin: React.FC<{position: [number, number, number]}> = ({position}) => {
  const camera = useThree((s) => s.camera);
  useLayoutEffect(() => {
    camera.position.set(...position);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }, [camera, position[0], position[1], position[2]]);
  return null;
};

// 2:1 orthographic projection: same camera direction for every component.
export const OrthographicStage: React.FC<Props> = ({
  children, zoom = 70, position = [8, 6.53, 8],
  background = '#F1EEE8',
}) => {
  const {width, height} = useVideoConfig();
  return (
    <ThreeCanvas orthographic width={width} height={height}
      camera={{position, zoom}}
      style={{position: 'absolute', width, height, inset: 0, backgroundColor: background}}>
      <AimAtOrigin position={position} />
      <ambientLight intensity={1.65} />
      <directionalLight position={[5, 10, 7]} intensity={2.2} />
      {children}
    </ThreeCanvas>
  );
};

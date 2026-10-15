import React from 'react';
import {Composition, Folder} from 'remotion';
import {HbmInfrastructureCheck} from '@mymg/hbm';
import {SystemCheck} from './system-check';

// Register all compositions in ONE Studio; do not create a new Studio per animation.
export const StudioRoot: React.FC = () => (
  <>
    <Composition id="SystemCheck" component={SystemCheck}
      durationInFrames={60} fps={30} width={1280} height={720} />
    <Folder name="Animations">
      <Composition id="HBMInfrastructureCheck" component={HbmInfrastructureCheck}
        durationInFrames={150} fps={30} width={1280} height={720} />
    </Folder>
  </>
);

import React from 'react';
import {Composition, Folder} from 'remotion';
import {projects} from '../../portal/src/catalog';
import {SystemCheck} from './system-check';

// Portal and Studio share ONE typed catalog; no duplicate registration.
export const StudioRoot: React.FC = () => (
  <>
    <Composition id="SystemCheck" component={SystemCheck}
      durationInFrames={60} fps={30} width={1280} height={720} />
    <Folder name="Animations">
      {projects.map(project => <Composition key={project.compositionId}
        id={project.compositionId} component={project.component}
        durationInFrames={project.durationInFrames} fps={project.fps}
        width={project.width} height={project.height} />)}
    </Folder>
  </>
);

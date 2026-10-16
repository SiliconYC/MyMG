# Steam Engine / Three.js cutaway

Original 32-second, 960-frame, native React + Remotion + Three.js teaching animation. No video, frame stills, textures or network media.

- True slider-crank kinematics: flywheel, crank, connecting rod, crosshead, piston and rod all synchronized.
- Native Three.js front-side clipping plane on the outer cylinder, valve housing and collars. Dynamic metal section edges trace the advancing knife plane. Piston and steam continue moving at every cut depth.
- Double-acting steam cycle with changing hot/cool chamber pressure, inlet/exhaust streams, sliding spool valve and fixed guides.
- Frames 0–40 intact; 40–152 section opens; 152–365 cut held; 365–475 restored; 475–539 intact.
- Boiler provides external steam: the cylinder is not a combustion chamber.

## Watt flyball governor, added after 18 seconds

- Same single 3D steam engine and shared catalog entry, with cinematic pan and dolly to its governor.
- Drive spindle, two symmetric heavy balls, top/bottom parallelogram links and a vertical sliding sleeve.
- Sleeve drives a throttling butterfly on the boiler inlet; valve area reduces as overspeed lifts the sleeve.
- Engine crank/piston, flyballs and valve share a frame-pure integrated feedback model (`web/src/governor-model.ts`).
- Demonstration: a temporary reduction of mechanical load raises engine speed at 21–23 s; centrifugal balls move out and sleeve rises; throttle closes, torque decreases, and speed settles again by about 28 s.
- Gains/dimensions are educational and approximate, not a validated historical regulator engineering design.
- Added pure model tests and live Chromium WebGL snapshots (load step, response, recovery). No MP4 / video / pre-rendered frames.

Portal route: https://siliconyc.github.io/MyMG/#/steam-engine

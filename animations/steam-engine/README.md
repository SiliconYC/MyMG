# Steam engine / Three.js governor & cutaway

14-second, 420-frame native React + Remotion + Three.js teaching animation. No video, still-frame sequence or prerecorded media.

## Where the governor belongs

The two-ball centrifugal regulator now sits on the engine bed directly above and **behind the flywheel drive**, rather than on a detached stand to its far right. The flywheel shaft drives a pair of belt pulleys; the governor's foot has schematic bevel gearing which turns the belt's horizontal rotation into a vertical spindle. A collar slides on that spindle, driving a distinct pivoted bell crank and pull rod that turn a **butterfly valve inline on the boiler-to-steam-chest inlet**. All the rods end on their actual connected joints.

This is a conceptually representative industrial engine layout, not an exact dimensional replica of any particular Watt machine. Primary historical references:
- Smithsonian history of centrifugal governors, including the 1819 Holloway governor and the Boulton & Watt arrangement: https://repository.si.edu/server/api/core/bitstreams/c0083579-4f8a-46bc-8bc7-198268fb772b/content
- Powerhouse Museum, Boulton & Watt brewery rotative engine: https://artsandculture.google.com/asset/boulton-and-watt-steam-engine-boulton-and-watt/vwHNf6ooYEol1A
- Birmingham Museums, flyball governor and steam cutoff: https://www.birminghammuseums.org.uk/objects/agricultural-engine-1825

## Cut-to-cut editorial timeline (14 s)

- **0–0.8 s** – whole steam engine, flywheel and governor.
- **0.8–2.8 s** – rapid move to the cylinder; advancing spatial cutting plane reveals the working piston.
- **2.8–4.0 s** – detailed held cut, mechanical action remains continuous.
- **4.0–4.85 s** – shell retracts; the drive remains visible.
- **4.8–5.4 s** – swift lateral and upward 3D camera move to the flywheel / mounted governor.
- **5.4–6.55 s** – see balls, driven spindle, sleeve and inlet throttle together.
- **6.55–8.5 s** – a real load relief disturbs the crank; balls open, sleeve lifts and valve closes.
- **8.5–11.3 s** – torque decreases, flywheel settles back to normal.
- **11.3–14 s** – short stable view; no prolonged pan or multi-second empty hold.

The operating model `web/src/governor-model.ts` integrates the rotor speed from load and steam torque. Its governor equilibrium, finite lag, sleeve displacement and throttle restriction are calculated from one state. Crank/piston and flyballs are coupled to that integrated shaft angle, not separately keyframed.

The cylinder's outer shell is actually clipped by Three.js; piston/steam internals never freeze. Browser QA covers moving section geometry, governor mounting position, live feedback, brief camera transition, labels and mobile controls.

Viewer: https://siliconyc.github.io/MyMG/#/steam-engine

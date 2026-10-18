# Recoil anchor implementation plan

> Execute inline with test-driven development. The user explicitly waived further design and workflow approval questions on 2026-10-18.

**Goal:** Replace the floating pallet animation with a physically coupled recoil anchor and publish the verified clock on Pages.

**Architecture:** Shared finite-face geometry, fixed-step two-axis contact dynamics and cached deterministic frame sampling feed the existing Three.js scene. Geometry and dynamics are independently audited.

**Tech stack:** TypeScript, React, Three.js, Remotion, Node test runner, Playwright, pnpm.

**Spec:** `docs/superpowers/specs/2026-10-18-recoil-anchor-design.md`

## Global constraints

- 30 teeth; 60-second seekable scene; real alternating contact and recoil.
- Only gravity, constant wheel torque, damping, contact and one initial condition drive motion.
- Shared rendered and audited working profiles; preserve the independent physics lab.
- Commit to dev, push GitHub, verify the deployed build and public route.

## Review focus

- Finite working-face endpoints and reverse motion must not bypass contact.
- Both whole solids and actual bevels must clear at contact, including fractional frames.
- Cold seeking, backwards seeking and replay must be deterministic and responsive.
- Drive-off and timestep refinement must expose false energy or unstable contact.
- Public mobile and desktop playback must use the new build without runtime errors.

## Task 1: Geometry and dynamics

- [x] Add a regression test proving the old marked lock has no contact; observe failure.
- [x] Construct finite recoil working faces and matching wheel/anchor outlines.
- [x] Implement two-axis fixed-step contact dynamics, events, diagnostics and frame cache.
- [x] Test real contact, 60-second alternation, recoil, energy/drive-off, convergence and seek.

Produces `clockAtFrame`, geometry profiles and contact diagnostics consumed by Tasks 2 and 3. Keep the existing scene entry point.

## Task 2: Scene and browser verification

- [x] Render the shared profiles, refine steel/brass geometry and inspect working faces.
- [x] Replace old fake-gap and monotonic-wheel browser assertions with physical assertions.
- [x] Run desktop/mobile WebGL QA, seek/play/pause checks and inspect screenshots.

Consumes Task 1 states; produces the reviewable scene and browser evidence.

## Task 3: Verification and release

- [x] Update blueprint and README with parameters, measured results and limitations.
- [x] Run `pnpm check`, `pnpm build:portal` and `pnpm --filter @mymg/portal qa:clock`.
- [x] Perform whole-branch review, fix actionable findings, rerun affected checks.
- [x] Merge to dev, push origin/dev, wait for Pages and verify public route/build.

## Execution record

- Baseline: 64/64 tests passed before implementation; working tree clean.
- User waived further approval gates; inline execution chosen. Push and publish were explicitly requested.

- Task 1 complete: real contact regression failed on the original floating lock; final geometry/dynamics pass all 16 focused tests.
- Task 2 complete: desktop/mobile Chromium WebGL QA passed; screenshot inspection prompted tapered heels, inward bevels, readable captions and a light ceramic dial back.
- Ruling: represent omitted clock case as ideal fixed journals, and use a continuous rib-envelope proof plus substep shoe contacts for whole-body coverage — preserves correct contact while avoiding redundant polygon work.
- Review fix: cold seeking stalled the main thread; cached normals, SAT early-outs and shared per-substep manifolds reduce fresh Chromium0→1799 to461ms. Browser regression checks cold seek before warmup with a3000ms budget.
- Independent review: no remaining code blockers; 2500-pose exhaustive tooth comparison and direct fractional replay passed.
- Pre-release verification: pnpm check56/56 plus all typechecks; production build; desktop/mobile browser QA.

- Task 3 complete: implementation47fcf48 merged to dev and pushed; Pages run39084191227 succeeded. Canonical public page reports BUILD47fcf48f3edb and passes the same desktop/mobile QA with400ms cold seek and no runtime/resource errors. Release evidence documented in animations/pendulum-clock/RESULTS.md.

# Parked pachinko experiment

The Three.js and cannon-es pachinko implementation is intentionally preserved but not used by the live host-message flow.

## Why it was parked

The machine itself is successful, but a multi-second physical drop adds the wrong kind of ceremony before a short scheduled host message. Host-message random variables now resolve uniformly and appear directly inside the styled message.

## Preserved implementation

- `src/components/game/PachinkoDraw.tsx` renders the Three.js scene and replays a persisted launch.
- `src/lib/pachinkoPhysics.ts` owns the cannon-es board, pins, gravity, collision bodies, and landing calculation.
- Optional launch fields remain backward-compatible in `ResolvedHostMessage`.
- `three`, `cannon-es`, and `@types/three` remain installed for the experiment.

## Good future uses

- A standalone bonus challenge
- A dedicated team draw initiated by the host
- A risk/reward minigame where the physical journey is itself the event

To reactivate it, build a deliberate trigger and pass a candidate list, selected result, persisted launch position, and velocity to `PachinkoDraw`. Do not silently place it back in every scheduled host message.

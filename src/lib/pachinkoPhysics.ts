import * as CANNON from "cannon-es";

export const PACHINKO_HALF_WIDTH = 10.2;
export const PACHINKO_TOP = 4.15;
export const PACHINKO_FLOOR = -3.55;
export const PACHINKO_BALL_RADIUS = 0.27;
export const PACHINKO_PEG_RADIUS = 0.145;
export const PACHINKO_FIXED_STEP = 1 / 120;
export const PACHINKO_SIMULATION_STEPS = 720;

export const PACHINKO_PHYSICS_VERSION = 3;

const PEG_COLUMNS = 11;
const PEG_ROWS = 8;

export type PachinkoPhysics = {
  world: CANNON.World;
  ball: CANNON.Body;
  pegs: Array<{ x: number; y: number }>;
  dividers: number[];
};

export function getPachinkoPegPositions() {
  const pegs: Array<{ x: number; y: number }> = [];
  const horizontalGap = 1.58;
  const verticalGap = 0.76;
  for (let row = 0; row < PEG_ROWS; row += 1) {
    const columns = row % 2 === 0 ? PEG_COLUMNS : PEG_COLUMNS - 1;
    for (let column = 0; column < columns; column += 1) {
      pegs.push({
        x: (column - (columns - 1) / 2) * horizontalGap,
        y: 3.02 - row * verticalGap,
      });
    }
  }
  return pegs;
}

export function createPachinkoPhysics(
  candidateCount: number,
  launchX: number,
  launchVelocityX: number,
): PachinkoPhysics {
  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -13.8, 0) });
  world.allowSleep = true;
  world.defaultContactMaterial.friction = 0.035;
  world.defaultContactMaterial.restitution = 0.48;
  world.defaultContactMaterial.contactEquationStiffness = 1e8;
  world.defaultContactMaterial.contactEquationRelaxation = 3;

  const addStaticBox = (halfX: number, halfY: number, x: number, y: number) => {
    const body = new CANNON.Body({
      mass: 0,
      shape: new CANNON.Box(new CANNON.Vec3(halfX, halfY, 0.42)),
      position: new CANNON.Vec3(x, y, 0),
    });
    world.addBody(body);
  };

  addStaticBox(0.12, 4.3, -PACHINKO_HALF_WIDTH - 0.12, 0);
  addStaticBox(0.12, 4.3, PACHINKO_HALF_WIDTH + 0.12, 0);
  addStaticBox(PACHINKO_HALF_WIDTH + 0.25, 0.11, 0, PACHINKO_FLOOR - 0.11);

  const safeCandidateCount = Math.max(1, candidateCount);
  const slotWidth = (PACHINKO_HALF_WIDTH * 2) / safeCandidateCount;
  const dividers = Array.from({ length: Math.max(0, safeCandidateCount - 1) }, (_, index) => (
    -PACHINKO_HALF_WIDTH + slotWidth * (index + 1)
  ));
  dividers.forEach((x) => addStaticBox(0.045, 0.46, x, PACHINKO_FLOOR + 0.46));

  const pegs = getPachinkoPegPositions();
  pegs.forEach(({ x, y }) => {
    world.addBody(new CANNON.Body({
      mass: 0,
      shape: new CANNON.Sphere(PACHINKO_PEG_RADIUS),
      position: new CANNON.Vec3(x, y, 0),
    }));
  });

  const ball = new CANNON.Body({
    mass: 1,
    shape: new CANNON.Sphere(PACHINKO_BALL_RADIUS),
    position: new CANNON.Vec3(launchX, PACHINKO_TOP, 0),
    velocity: new CANNON.Vec3(launchVelocityX, 0, 0),
    linearDamping: 0.018,
    angularDamping: 0.08,
    sleepSpeedLimit: 0.08,
    sleepTimeLimit: 0.35,
  });
  ball.linearFactor.set(1, 1, 0);
  ball.angularFactor.set(0, 0, 1);
  ball.angularVelocity.set(0, 0, -launchVelocityX * 1.4);
  world.addBody(ball);

  return { world, ball, pegs, dividers };
}

export function getPachinkoSlot(x: number, candidateCount: number) {
  const safeCandidateCount = Math.max(1, candidateCount);
  const normalized = (x + PACHINKO_HALF_WIDTH) / (PACHINKO_HALF_WIDTH * 2);
  return Math.max(0, Math.min(safeCandidateCount - 1, Math.floor(normalized * safeCandidateCount)));
}

export function createPachinkoOutcome(candidateCount: number, random: () => number) {
  // A real pachinko-style gate releases from the center. Tiny variations keep
  // repeated drops physical without letting the marble bypass the pin field.
  const launchX = (random() - 0.5) * 0.14;
  const launchVelocityX = (random() - 0.5) * 0.65;
  const physics = createPachinkoPhysics(candidateCount, launchX, launchVelocityX);
  for (let step = 0; step < PACHINKO_SIMULATION_STEPS; step += 1) {
    physics.world.step(PACHINKO_FIXED_STEP);
  }
  return {
    selectedIndex: getPachinkoSlot(physics.ball.position.x, candidateCount),
    launchX,
    launchVelocityX,
  };
}

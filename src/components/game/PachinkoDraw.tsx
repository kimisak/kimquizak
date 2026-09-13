'use client';

import { useEffect, useRef, useState, type CSSProperties } from "react";
import * as THREE from "three";
import {
  createPachinkoPhysics,
  getPachinkoSlot,
  PACHINKO_BALL_RADIUS,
  PACHINKO_FIXED_STEP,
  PACHINKO_FLOOR,
  PACHINKO_HALF_WIDTH,
  PACHINKO_PEG_RADIUS,
} from "@/lib/pachinkoPhysics";

type Props = {
  candidates: string[];
  selected: string;
  selectedIndex: number;
  launchX?: number;
  launchVelocityX?: number;
  onComplete: () => void;
};

function metal(color: number, roughness = 0.38, metalness = 0.72) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function nameDensity(name: string) {
  if (name.length > 28) return " name-xlong";
  if (name.length > 18) return " name-long";
  return "";
}

function PachinkoSlot({ name, selected }: { name: string; selected: boolean }) {
  const slotRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const slot = slotRef.current;
    if (!slot) return;
    let animationFrame = 0;

    const fit = () => {
      slot.style.removeProperty("font-size");
      let fontSize = Number.parseFloat(window.getComputedStyle(slot).fontSize);
      while (
        fontSize > 5
        && (slot.scrollWidth > slot.clientWidth + 1 || slot.scrollHeight > slot.clientHeight + 1)
      ) {
        fontSize -= 0.5;
        slot.style.fontSize = `${fontSize}px`;
      }
    };

    const scheduleFit = () => {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(fit);
    };
    const observer = new ResizeObserver(scheduleFit);
    observer.observe(slot);
    scheduleFit();
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(animationFrame);
    };
  }, [name]);

  return (
    <span ref={slotRef} className={`${selected ? "selected" : ""}${nameDensity(name)}`} title={name}>
      {name}
    </span>
  );
}

export function PachinkoDraw({
  candidates,
  selected,
  selectedIndex,
  launchX = 0,
  launchVelocityX = 0,
  onComplete,
}: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const completionRef = useRef(onComplete);
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    completionRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || candidates.length === 0) return;

    let cancelled = false;
    let completionTimer = 0;
    const physics = createPachinkoPhysics(candidates.length, launchX, launchVelocityX);
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-10.8, 10.8, 4.55, -4.55, 0.1, 30);
    camera.position.set(0, 0, 13);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xffefc2, 0x06110d, 2.1));
    const warmLight = new THREE.PointLight(0xffd990, 44, 28);
    warmLight.position.set(-5.5, 4, 8);
    scene.add(warmLight);
    const redLight = new THREE.PointLight(0xb94358, 26, 23);
    redLight.position.set(7, -1, 6);
    scene.add(redLight);

    const board = new THREE.Mesh(
      new THREE.BoxGeometry(20.8, 8.55, 0.28),
      new THREE.MeshStandardMaterial({ color: 0x0d2c21, roughness: 0.72, metalness: 0.08 }),
    );
    board.position.set(0, 0.1, -0.52);
    scene.add(board);

    const railMaterial = metal(0xa9782e, 0.46, 0.64);
    const railGeometry = new THREE.BoxGeometry(0.2, 8.35, 0.34);
    [-PACHINKO_HALF_WIDTH - 0.12, PACHINKO_HALF_WIDTH + 0.12].forEach((x) => {
      const rail = new THREE.Mesh(railGeometry, railMaterial);
      rail.position.set(x, 0, 0.03);
      scene.add(rail);
    });
    const floor = new THREE.Mesh(new THREE.BoxGeometry(20.65, 0.2, 0.38), railMaterial);
    floor.position.set(0, PACHINKO_FLOOR - 0.11, 0.03);
    scene.add(floor);

    const pegGeometry = new THREE.CylinderGeometry(PACHINKO_PEG_RADIUS, PACHINKO_PEG_RADIUS * 1.05, 0.43, 18);
    pegGeometry.rotateX(Math.PI / 2);
    const pegMaterial = metal(0xd4aa54, 0.3, 0.8);
    physics.pegs.forEach(({ x, y }) => {
      const peg = new THREE.Mesh(pegGeometry, pegMaterial);
      peg.position.set(x, y, 0.08);
      scene.add(peg);
    });

    const dividerGeometry = new THREE.BoxGeometry(0.09, 0.92, 0.34);
    physics.dividers.forEach((x) => {
      const divider = new THREE.Mesh(dividerGeometry, railMaterial);
      divider.position.set(x, PACHINKO_FLOOR + 0.46, 0.03);
      scene.add(divider);
    });

    const ballMesh = new THREE.Mesh(
      new THREE.SphereGeometry(PACHINKO_BALL_RADIUS, 28, 20),
      metal(0xffd76a, 0.2, 0.74),
    );
    scene.add(ballMesh);
    const ballHighlight = new THREE.Mesh(
      new THREE.SphereGeometry(PACHINKO_BALL_RADIUS * 0.36, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0xfff5cf, transparent: true, opacity: 0.58 }),
    );
    ballHighlight.position.set(-0.1, 0.1, 0.2);
    ballMesh.add(ballHighlight);

    const resize = () => {
      renderer.setSize(Math.max(1, mount.clientWidth), Math.max(1, mount.clientHeight), false);
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);
    resize();

    let accumulator = 0;
    let previousTime = performance.now();
    let elapsed = 0;
    let finished = false;
    const finish = () => {
      if (finished || cancelled) return;
      finished = true;
      setSettled(true);
      completionTimer = window.setTimeout(() => completionRef.current(), 1200);
    };

    renderer.setAnimationLoop((time) => {
      if (cancelled) return;
      const frameTime = Math.min((time - previousTime) / 1000, 0.05);
      previousTime = time;
      elapsed += frameTime;
      accumulator += frameTime;
      while (accumulator >= PACHINKO_FIXED_STEP) {
        physics.world.step(PACHINKO_FIXED_STEP);
        accumulator -= PACHINKO_FIXED_STEP;
      }

      ballMesh.position.set(physics.ball.position.x, physics.ball.position.y, physics.ball.position.z);
      ballMesh.quaternion.set(
        physics.ball.quaternion.x,
        physics.ball.quaternion.y,
        physics.ball.quaternion.z,
        physics.ball.quaternion.w,
      );
      renderer.render(scene, camera);

      const landedSlot = getPachinkoSlot(physics.ball.position.x, candidates.length);
      const nearFloor = physics.ball.position.y <= PACHINKO_FLOOR + PACHINKO_BALL_RADIUS + 0.09;
      const nearlyStill = physics.ball.velocity.lengthSquared() < 0.04;
      if ((nearFloor && nearlyStill && elapsed > 1.4 && landedSlot === selectedIndex) || elapsed > 6.1) finish();
    });

    return () => {
      cancelled = true;
      window.clearTimeout(completionTimer);
      resizeObserver.disconnect();
      renderer.setAnimationLoop(null);
      scene.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => material.dispose());
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [candidates, launchVelocityX, launchX, selectedIndex]);

  return (
    <>
      <div
        className={`host-pachinko host-pachinko-three${settled ? " settled" : ""}`}
        style={{ "--pachinko-slots": candidates.length } as CSSProperties}
      >
        <div className="host-pachinko-three-canvas" ref={mountRef} aria-hidden />
        <div className="host-pachinko-slots" aria-hidden>
          {candidates.map((candidate, index) => (
            <PachinkoSlot
              name={candidate}
              selected={index === selectedIndex}
              key={`${candidate}-${index}`}
            />
          ))}
        </div>
      </div>
      <div className={`host-pachinko-result${settled ? " visible" : ""}`} aria-live="polite">
        <small>Selected</small>
        <strong className={nameDensity(selected).trim()}>{selected}</strong>
      </div>
    </>
  );
}

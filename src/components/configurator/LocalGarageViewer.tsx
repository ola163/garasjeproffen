"use client";

import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import { OrbitControls, Environment, Grid } from "@react-three/drei";

interface LocalGarageViewerProps {
  lengthMm: number;
  widthMm: number;
  doorWidthMm: number;
  doorHeightMm: number;
}

// ── Palette ────────────────────────────────────────────────────────────────
const WALL_COLOR  = "#d6d3d1"; // stone-300
const ROOF_COLOR  = "#78716c"; // stone-500
const DOOR_COLOR  = "#57534e"; // stone-600
const FLOOR_COLOR = "#e7e5e4"; // stone-200

// ── Constants ──────────────────────────────────────────────────────────────
const WALL_H  = 3.0;  // metres
const WALL_T  = 0.08; // wall thickness
const ROOF_T  = 0.15; // roof slab thickness
const OVERHANG = 0.35; // roof overhang beyond walls
const DOOR_PANELS = 4; // number of horizontal door panel sections

function GarageGeometry({
  lengthM,
  widthM,
  doorWidthM,
  doorHeightM,
}: {
  lengthM: number;
  widthM: number;
  doorWidthM: number;
  doorHeightM: number;
}) {
  const H     = WALL_H;
  const T     = WALL_T;
  const halfW = widthM  / 2;
  const halfL = lengthM / 2;
  const sideW = (widthM - doorWidthM) / 2; // VeggC
  const panelH = doorHeightM / DOOR_PANELS;
  const aboveDoor = H - doorHeightM;

  return (
    <group>
      {/* ── Floor ─────────────────────────────────────── */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]} receiveShadow>
        <planeGeometry args={[widthM - T * 2, lengthM - T * 2]} />
        <meshStandardMaterial color={FLOOR_COLOR} />
      </mesh>

      {/* ── Back wall ─────────────────────────────────── */}
      <mesh position={[0, H / 2, -halfL + T / 2]} castShadow receiveShadow>
        <boxGeometry args={[widthM, H, T]} />
        <meshStandardMaterial color={WALL_COLOR} />
      </mesh>

      {/* ── Left wall ─────────────────────────────────── */}
      <mesh position={[-halfW + T / 2, H / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[T, H, lengthM]} />
        <meshStandardMaterial color={WALL_COLOR} />
      </mesh>

      {/* ── Right wall ────────────────────────────────── */}
      <mesh position={[halfW - T / 2, H / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[T, H, lengthM]} />
        <meshStandardMaterial color={WALL_COLOR} />
      </mesh>

      {/* ── Front wall – left pier (VeggC) ────────────── */}
      {sideW > 0.01 && (
        <mesh position={[-halfW + sideW / 2, H / 2, halfL - T / 2]} castShadow receiveShadow>
          <boxGeometry args={[sideW, H, T]} />
          <meshStandardMaterial color={WALL_COLOR} />
        </mesh>
      )}

      {/* ── Front wall – right pier (VeggC) ───────────── */}
      {sideW > 0.01 && (
        <mesh position={[halfW - sideW / 2, H / 2, halfL - T / 2]} castShadow receiveShadow>
          <boxGeometry args={[sideW, H, T]} />
          <meshStandardMaterial color={WALL_COLOR} />
        </mesh>
      )}

      {/* ── Front wall – lintel above door ────────────── */}
      {aboveDoor > 0.02 && (
        <mesh
          position={[0, doorHeightM + aboveDoor / 2, halfL - T / 2]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[doorWidthM, aboveDoor, T]} />
          <meshStandardMaterial color={WALL_COLOR} />
        </mesh>
      )}

      {/* ── Garage door – horizontal panels ───────────── */}
      {Array.from({ length: DOOR_PANELS }).map((_, i) => (
        <mesh
          key={i}
          position={[0, i * panelH + panelH / 2, halfL - T / 2 + 0.005]}
        >
          <boxGeometry args={[doorWidthM - 0.06, panelH - 0.04, 0.025]} />
          <meshStandardMaterial color={DOOR_COLOR} />
        </mesh>
      ))}

      {/* ── Flat roof with overhang ────────────────────── */}
      <mesh position={[0, H + ROOF_T / 2, 0]} castShadow receiveShadow>
        <boxGeometry
          args={[widthM + OVERHANG * 2, ROOF_T, lengthM + OVERHANG * 2]}
        />
        <meshStandardMaterial color={ROOF_COLOR} />
      </mesh>
    </group>
  );
}

export default function LocalGarageViewer({
  lengthMm,
  widthMm,
  doorWidthMm,
  doorHeightMm,
}: LocalGarageViewerProps) {
  const lengthM    = lengthMm    / 1000;
  const widthM     = widthMm     / 1000;
  const doorWidthM = doorWidthMm / 1000;
  const doorHeightM = doorHeightMm / 1000;

  return (
    <div className="relative h-full w-full">
      <Canvas
        shadows
        camera={{ position: [12, 7, 12], fov: 42 }}
        gl={{ toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0 }}
      >
        <color attach="background" args={["#f5f5f4"]} />
        <ambientLight intensity={0.65} />
        <directionalLight
          position={[10, 15, 10]}
          intensity={1.2}
          castShadow
          shadow-mapSize={[2048, 2048]}
        />

        <Suspense fallback={null}>
          <GarageGeometry
            lengthM={lengthM}
            widthM={widthM}
            doorWidthM={doorWidthM}
            doorHeightM={doorHeightM}
          />
        </Suspense>

        <Grid
          position={[0, -0.02, 0]}
          args={[30, 30]}
          cellSize={1}
          cellThickness={0.5}
          cellColor="#d1d5db"
          sectionSize={5}
          sectionThickness={1}
          sectionColor="#9ca3af"
          fadeDistance={30}
          fadeStrength={1}
        />

        <Environment preset="city" />

        <OrbitControls
          enablePan
          enableZoom
          enableRotate
          minPolarAngle={0.1}
          maxPolarAngle={Math.PI / 2.2}
          minDistance={4}
          maxDistance={30}
        />
      </Canvas>
    </div>
  );
}

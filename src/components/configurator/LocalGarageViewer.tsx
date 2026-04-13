"use client";

import { useMemo, Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import { OrbitControls, Environment, Grid } from "@react-three/drei";

interface LocalGarageViewerProps {
  lengthMm: number;
  widthMm: number;
  doorWidthMm: number;
  doorHeightMm: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const WALL_H     = 3.0;           // wall height in metres
const WALL_T     = 0.10;          // wall thickness
const ROOF_T     = 0.10;          // roof panel thickness
const OVERHANG   = 0.40;          // roof overhang at front/back
const ROOF_ANGLE = 22 * (Math.PI / 180); // 22° in radians

// ── Colors from the logo ──────────────────────────────────────────────────────
const WALL_COLOR  = "#f5f5f5"; // near-white walls (like the logo garage)
const ROOF_COLOR  = "#e2520a"; // brand orange (roof and helmet in logo)
const DOOR_COLOR  = "#1c1917"; // near-black door panel (dark opening in logo)
const FLOOR_COLOR = "#e7e5e4"; // light stone floor

// ── Triangular gable end above the wall ───────────────────────────────────────
function GableEnd({
  z,
  halfW,
  ridgeH,
}: {
  z: number;
  halfW: number;
  ridgeH: number;
}) {
  const shape = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(-halfW, 0);
    s.lineTo(halfW, 0);
    s.lineTo(0, ridgeH);
    s.closePath();
    return s;
  }, [halfW, ridgeH]);

  return (
    <mesh position={[0, WALL_H, z]} castShadow receiveShadow>
      <shapeGeometry args={[shape]} />
      <meshStandardMaterial color={WALL_COLOR} side={THREE.DoubleSide} />
    </mesh>
  );
}

// ── Full garage geometry ───────────────────────────────────────────────────────
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
  const aboveDoor = H - doorHeightM;

  // ── Pitched roof geometry ──────────────────────────────────────────────────
  // ridgeH = halfW * tan(22°)  — height of ridge above wall top
  // slopeLen = halfW / cos(22°) — length along the slope from eave to ridge
  const ridgeH   = halfW * Math.tan(ROOF_ANGLE);
  const slopeLen = halfW / Math.cos(ROOF_ANGLE);
  const roofL    = lengthM + OVERHANG * 2; // roof length including overhangs

  // Slope center X = halfW / 2 away from ridge (i.e. ±halfW/2)
  // Slope center Y = H + ridgeH/2
  // Rotation ±ROOF_ANGLE around Z tilts eave down, ridge up
  const slopeCY = H + ridgeH / 2;

  // ── Door panels ────────────────────────────────────────────────────────────
  const PANELS = 4;
  const panelH = doorHeightM / PANELS;

  return (
    <group>
      {/* ── Floor ─────────────────────────────────────────────────── */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]} receiveShadow>
        <planeGeometry args={[widthM - T * 2, lengthM - T * 2]} />
        <meshStandardMaterial color={FLOOR_COLOR} />
      </mesh>

      {/* ── Back wall ─────────────────────────────────────────────── */}
      <mesh position={[0, H / 2, -halfL + T / 2]} castShadow receiveShadow>
        <boxGeometry args={[widthM, H, T]} />
        <meshStandardMaterial color={WALL_COLOR} />
      </mesh>

      {/* ── Left wall ─────────────────────────────────────────────── */}
      <mesh position={[-halfW + T / 2, H / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[T, H, lengthM]} />
        <meshStandardMaterial color={WALL_COLOR} />
      </mesh>

      {/* ── Right wall ────────────────────────────────────────────── */}
      <mesh position={[halfW - T / 2, H / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[T, H, lengthM]} />
        <meshStandardMaterial color={WALL_COLOR} />
      </mesh>

      {/* ── Front – left pier (VeggC) ─────────────────────────────── */}
      {sideW > 0.01 && (
        <mesh position={[-halfW + sideW / 2, H / 2, halfL - T / 2]} castShadow receiveShadow>
          <boxGeometry args={[sideW, H, T]} />
          <meshStandardMaterial color={WALL_COLOR} />
        </mesh>
      )}

      {/* ── Front – right pier (VeggC) ────────────────────────────── */}
      {sideW > 0.01 && (
        <mesh position={[halfW - sideW / 2, H / 2, halfL - T / 2]} castShadow receiveShadow>
          <boxGeometry args={[sideW, H, T]} />
          <meshStandardMaterial color={WALL_COLOR} />
        </mesh>
      )}

      {/* ── Front – lintel above door ──────────────────────────────── */}
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

      {/* ── Garage door – horizontal panel sections ────────────────── */}
      {Array.from({ length: PANELS }).map((_, i) => (
        <mesh
          key={i}
          position={[0, i * panelH + panelH / 2, halfL - T / 2 + 0.006]}
        >
          <boxGeometry args={[doorWidthM - 0.06, panelH - 0.05, 0.03]} />
          <meshStandardMaterial color={DOOR_COLOR} />
        </mesh>
      ))}

      {/* ── Left roof slope ────────────────────────────────────────── */}
      {/* Centre at (-halfW/2, H+ridgeH/2). Rotated +22° tilts right edge up to ridge. */}
      <mesh
        position={[-halfW / 2, slopeCY, 0]}
        rotation={[0, 0, ROOF_ANGLE]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[slopeLen, ROOF_T, roofL]} />
        <meshStandardMaterial color={ROOF_COLOR} />
      </mesh>

      {/* ── Right roof slope ───────────────────────────────────────── */}
      <mesh
        position={[halfW / 2, slopeCY, 0]}
        rotation={[0, 0, -ROOF_ANGLE]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[slopeLen, ROOF_T, roofL]} />
        <meshStandardMaterial color={ROOF_COLOR} />
      </mesh>

      {/* ── Ridge cap ─────────────────────────────────────────────── */}
      <mesh position={[0, H + ridgeH + ROOF_T / 2, 0]} castShadow>
        <boxGeometry args={[0.12, ROOF_T, roofL]} />
        <meshStandardMaterial color={ROOF_COLOR} />
      </mesh>

      {/* ── Gable ends (triangle above wall top) ──────────────────── */}
      <GableEnd z={-halfL + T / 2} halfW={halfW} ridgeH={ridgeH} />
      <GableEnd z={ halfL - T / 2} halfW={halfW} ridgeH={ridgeH} />
    </group>
  );
}

// ── Viewer ─────────────────────────────────────────────────────────────────────
export default function LocalGarageViewer({
  lengthMm,
  widthMm,
  doorWidthMm,
  doorHeightMm,
}: LocalGarageViewerProps) {
  const lengthM     = lengthMm     / 1000;
  const widthM      = widthMm      / 1000;
  const doorWidthM  = doorWidthMm  / 1000;
  const doorHeightM = doorHeightMm / 1000;

  return (
    <div className="relative h-full w-full">
      <Canvas
        shadows
        camera={{ position: [14, 8, 14], fov: 40 }}
        gl={{ toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0 }}
      >
        <color attach="background" args={["#f5f5f4"]} />
        <ambientLight intensity={0.55} />
        <directionalLight
          position={[12, 18, 10]}
          intensity={1.4}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-near={0.5}
          shadow-camera-far={80}
          shadow-camera-left={-20}
          shadow-camera-right={20}
          shadow-camera-top={20}
          shadow-camera-bottom={-20}
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
          args={[40, 40]}
          cellSize={1}
          cellThickness={0.5}
          cellColor="#d1d5db"
          sectionSize={5}
          sectionThickness={1}
          sectionColor="#9ca3af"
          fadeDistance={35}
          fadeStrength={1}
        />

        <Environment preset="city" />

        <OrbitControls
          enablePan
          enableZoom
          enableRotate
          minPolarAngle={0.1}
          maxPolarAngle={Math.PI / 2.2}
          minDistance={5}
          maxDistance={40}
        />
      </Canvas>
    </div>
  );
}

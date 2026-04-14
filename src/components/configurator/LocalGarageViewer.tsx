"use client";

import { useMemo, Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import { OrbitControls } from "@react-three/drei";

interface LocalGarageViewerProps {
  lengthMm: number;
  widthMm: number;
  doorWidthMm: number;
  doorHeightMm: number;
}

// ── Dimensions ───────────────────────────────────────────────────────────────
const WALL_H     = 3.0;
const WALL_T     = 0.12;
const ROOF_T     = 0.12;
const OVERHANG   = 0.40;
const ROOF_ANGLE = 22 * (Math.PI / 180);

// ── Colors (from logo) ────────────────────────────────────────────────────────
const WALL_COLOR  = "#2C3A4A"; // dark charcoal-blue walls
const ROOF_COLOR  = "#e2520a"; // brand orange roof
const DOOR_COLOR  = "#F0F0EE"; // white garage door panels
const DOOR_FRAME  = "#FFFFFF"; // white frame
const PANEL_LINE  = "#D8D8D6"; // subtle panel dividers

// ── Gable end with proper wall thickness ─────────────────────────────────────
function GableEnd({ z, halfW, ridgeH, flip = false }: {
  z: number; halfW: number; ridgeH: number; flip?: boolean;
}) {
  const shape = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(-halfW, 0);
    s.lineTo( halfW, 0);
    s.lineTo(0, ridgeH);
    s.closePath();
    return s;
  }, [halfW, ridgeH]);

  const extrudeSettings = useMemo(() => ({ depth: WALL_T, bevelEnabled: false }), []);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({
    color: WALL_COLOR, roughness: 0.85, metalness: 0,
  }), []);

  return (
    <mesh
      position={[0, WALL_H, z]}
      rotation={flip ? [0, Math.PI, 0] : [0, 0, 0]}
      material={mat}
      castShadow receiveShadow
    >
      <extrudeGeometry args={[shape, extrudeSettings]} />
    </mesh>
  );
}

// ── Garage geometry ───────────────────────────────────────────────────────────
function GarageGeometry({ lengthM, widthM, doorWidthM, doorHeightM }: {
  lengthM: number; widthM: number; doorWidthM: number; doorHeightM: number;
}) {
  const H     = WALL_H;
  const T     = WALL_T;
  const halfW = widthM  / 2;
  const halfL = lengthM / 2;
  const sideW = (widthM - doorWidthM) / 2;
  const aboveDoor = H - doorHeightM;

  const ridgeH   = halfW * Math.tan(ROOF_ANGLE);
  const slopeLen = halfW / Math.cos(ROOF_ANGLE);
  const roofL    = lengthM + OVERHANG * 2;
  const slopeCY  = H + ridgeH / 2;

  // Door panels
  const PANELS = 4;
  const panelH = doorHeightM / PANELS;

  // ── Materials ─────────────────────────────────────────────────────────────
  const matWall = useMemo(() => new THREE.MeshStandardMaterial({
    color: WALL_COLOR, roughness: 0.85, metalness: 0,
  }), []);

  const matRoof = useMemo(() => new THREE.MeshStandardMaterial({
    color: ROOF_COLOR, roughness: 0.7, metalness: 0,
  }), []);

  const matDoorPanel = useMemo(() => new THREE.MeshStandardMaterial({
    color: DOOR_COLOR, roughness: 0.5, metalness: 0,
  }), []);

  const matDoorFrame = useMemo(() => new THREE.MeshStandardMaterial({
    color: DOOR_FRAME, roughness: 0.45, metalness: 0,
  }), []);

  const matPanelLine = useMemo(() => new THREE.MeshStandardMaterial({
    color: PANEL_LINE, roughness: 0.5, metalness: 0,
  }), []);

  return (
    <group>
      {/* ── Back wall ───────────────────────────────────────────────── */}
      <mesh position={[0, H / 2, -halfL + T / 2]}
            material={matWall} castShadow receiveShadow>
        <boxGeometry args={[widthM, H, T]} />
      </mesh>
      <GableEnd z={-halfL} halfW={halfW} ridgeH={ridgeH} flip={false} />

      {/* ── Left wall ───────────────────────────────────────────────── */}
      <mesh position={[-halfW + T / 2, H / 2, 0]}
            material={matWall} castShadow receiveShadow>
        <boxGeometry args={[T, H, lengthM]} />
      </mesh>

      {/* ── Right wall ──────────────────────────────────────────────── */}
      <mesh position={[halfW - T / 2, H / 2, 0]}
            material={matWall} castShadow receiveShadow>
        <boxGeometry args={[T, H, lengthM]} />
      </mesh>

      {/* ── Front – left pier ───────────────────────────────────────── */}
      {sideW > 0.01 && (
        <mesh position={[-halfW + sideW / 2, H / 2, halfL - T / 2]}
              material={matWall} castShadow receiveShadow>
          <boxGeometry args={[sideW, H, T]} />
        </mesh>
      )}

      {/* ── Front – right pier ──────────────────────────────────────── */}
      {sideW > 0.01 && (
        <mesh position={[halfW - sideW / 2, H / 2, halfL - T / 2]}
              material={matWall} castShadow receiveShadow>
          <boxGeometry args={[sideW, H, T]} />
        </mesh>
      )}

      {/* ── Front – lintel above door ────────────────────────────────── */}
      {aboveDoor > 0.02 && (
        <mesh position={[0, doorHeightM + aboveDoor / 2, halfL - T / 2]}
              material={matWall} castShadow receiveShadow>
          <boxGeometry args={[doorWidthM, aboveDoor, T]} />
        </mesh>
      )}

      {/* ── Front gable ─────────────────────────────────────────────── */}
      <GableEnd z={halfL} halfW={halfW} ridgeH={ridgeH} flip={true} />

      {/* ── Garage door frame ───────────────────────────────────────── */}
      <mesh position={[0, doorHeightM / 2, halfL - T / 2 + 0.01]}
            material={matDoorFrame} castShadow>
        <boxGeometry args={[doorWidthM + 0.10, doorHeightM + 0.08, 0.04]} />
      </mesh>

      {/* ── Garage door panels ──────────────────────────────────────── */}
      {Array.from({ length: PANELS }).map((_, i) => (
        <mesh key={i}
              position={[0, i * panelH + panelH / 2, halfL - T / 2 + 0.03]}
              material={matDoorPanel} castShadow>
          <boxGeometry args={[doorWidthM - 0.02, panelH - 0.04, 0.03]} />
        </mesh>
      ))}

      {/* ── Horizontal panel dividers ───────────────────────────────── */}
      {Array.from({ length: PANELS - 1 }).map((_, i) => (
        <mesh key={i}
              position={[0, (i + 1) * panelH, halfL - T / 2 + 0.045]}
              material={matPanelLine}>
          <boxGeometry args={[doorWidthM - 0.02, 0.025, 0.01]} />
        </mesh>
      ))}

      {/* ── Left roof slope ─────────────────────────────────────────── */}
      <mesh position={[-halfW / 2, slopeCY, 0]}
            rotation={[0, 0, ROOF_ANGLE]}
            material={matRoof} castShadow receiveShadow>
        <boxGeometry args={[slopeLen + 0.05, ROOF_T, roofL]} />
      </mesh>

      {/* ── Right roof slope ────────────────────────────────────────── */}
      <mesh position={[halfW / 2, slopeCY, 0]}
            rotation={[0, 0, -ROOF_ANGLE]}
            material={matRoof} castShadow receiveShadow>
        <boxGeometry args={[slopeLen + 0.05, ROOF_T, roofL]} />
      </mesh>
    </group>
  );
}

// ── Viewer ───────────────────────────────────────────────────────────────────
export default function LocalGarageViewer({
  lengthMm, widthMm, doorWidthMm, doorHeightMm,
}: LocalGarageViewerProps) {
  return (
    <div className="relative h-full w-full" style={{ background: "linear-gradient(to bottom, #d4e4f0 0%, #eef3f7 60%, #dde6ec 100%)" }}>
      <Canvas
        shadows
        camera={{ position: [14, 8, 14], fov: 40 }}
        gl={{ toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0, alpha: true }}
      >
        <ambientLight intensity={0.55} />
        <directionalLight
          position={[12, 20, 10]}
          intensity={1.5}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-28}
          shadow-camera-right={28}
          shadow-camera-top={28}
          shadow-camera-bottom={-28}
          shadow-camera-near={0.5}
          shadow-camera-far={90}
        />
        <directionalLight position={[-6, 4, -6]} intensity={0.22} />

        <Suspense fallback={null}>
          <GarageGeometry
            lengthM={lengthMm / 1000}
            widthM={widthMm / 1000}
            doorWidthM={doorWidthMm / 1000}
            doorHeightM={doorHeightMm / 1000}
          />
        </Suspense>

        <OrbitControls
          enablePan enableZoom enableRotate
          minPolarAngle={0.1}
          maxPolarAngle={Math.PI / 2.2}
          minDistance={5}
          maxDistance={40}
        />
      </Canvas>
    </div>
  );
}

"use client";

import { useMemo, Suspense, useEffect, useRef } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { OrbitControls } from "@react-three/drei";
import type { AddedElement, WallSide } from "./DoorWindowAdder";

interface LocalGarageViewerProps {
  lengthMm: number;
  widthMm: number;
  doorWidthMm: number;
  doorHeightMm: number;
  roofType?: "saltak" | "flattak";
  focusSide?: WallSide | null;
  addedElements?: AddedElement[];
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
function GarageGeometry({ lengthM, widthM, doorWidthM, doorHeightM, roofType = "saltak" }: {
  lengthM: number; widthM: number; doorWidthM: number; doorHeightM: number; roofType?: "saltak" | "flattak";
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
      {roofType === "saltak" && <GableEnd z={-halfL} halfW={halfW} ridgeH={ridgeH} flip={false} />}

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
      {roofType === "saltak" && <GableEnd z={halfL} halfW={halfW} ridgeH={ridgeH} flip={true} />}

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

      {roofType === "saltak" ? (
        <>
          {/* ── Left roof slope ───────────────────────────────────────── */}
          <mesh position={[-halfW / 2, slopeCY, 0]}
                rotation={[0, 0, ROOF_ANGLE]}
                material={matRoof} castShadow receiveShadow>
            <boxGeometry args={[slopeLen + 0.05, ROOF_T, roofL]} />
          </mesh>

          {/* ── Right roof slope ──────────────────────────────────────── */}
          <mesh position={[halfW / 2, slopeCY, 0]}
                rotation={[0, 0, -ROOF_ANGLE]}
                material={matRoof} castShadow receiveShadow>
            <boxGeometry args={[slopeLen + 0.05, ROOF_T, roofL]} />
          </mesh>
        </>
      ) : (
        /* ── Flat roof ──────────────────────────────────────────────── */
        <mesh position={[0, H + ROOF_T / 2, 0]}
              material={matRoof} castShadow receiveShadow>
          <boxGeometry args={[widthM, ROOF_T, lengthM]} />
        </mesh>
      )}
    </group>
  );
}

// ── Element colors ────────────────────────────────────────────────────────────
const WINDOW_COLOR  = "#9ECFEA";
const DOOR_EL_COLOR = "#C4A882";
const FRAME_COLOR   = "#FFFFFF";
const SILL_COLOR    = "#E0E0DE";

// Window extrusion constants
const FRAME_BORDER = 0.055;  // frame width around glass on each side
const FRAME_DEPTH  = 0.10;   // how far the frame protrudes from the wall face
const GLASS_INSET  = 0.04;   // glass set back from the outer face of the frame
const SILL_H       = 0.035;  // sill height
const SILL_EXTRA   = 0.05;   // extra sill depth beyond frame

// ── Added elements renderer ───────────────────────────────────────────────────
function GarageElements({ elements, lengthM, widthM }: {
  elements: AddedElement[]; lengthM: number; widthM: number;
}) {
  const H     = WALL_H;
  const halfL = lengthM / 2;
  const halfW = widthM  / 2;

  const matWindow = useMemo(() => new THREE.MeshStandardMaterial({ color: WINDOW_COLOR, roughness: 0.05, metalness: 0.3 }), []);
  const matDoorEl = useMemo(() => new THREE.MeshStandardMaterial({ color: DOOR_EL_COLOR, roughness: 0.6 }), []);
  const matFrame  = useMemo(() => new THREE.MeshStandardMaterial({ color: FRAME_COLOR,   roughness: 0.5 }), []);
  const matSill   = useMemo(() => new THREE.MeshStandardMaterial({ color: SILL_COLOR,    roughness: 0.55 }), []);

  const meshes: React.ReactNode[] = [];

  elements.forEach((el, idx) => {
    const w  = el.category === "door" ? 0.9 : 1.0;
    const h  = el.category === "door"    ? 2.1
             : el.category === "window1" ? 0.5
             : el.category === "window3" ? 1.0 : 0.6;
    const cy       = el.category === "door" ? h / 2 : H * 0.55;
    const isWindow = el.category !== "door";

    const placements = el.placement === "both" ? [-0.25, 0.25]
                     : el.placement === "left"  ? [0.25]
                     : [-0.25];

    placements.forEach((frac, pi) => {
      const key = `${idx}-${pi}`;

      if (el.side === "front" || el.side === "back") {
        const dir      = el.side === "front" ? 1 : -1;
        const wallFace = dir * halfL;   // z of outer wall face
        const x        = widthM * frac;

        if (isWindow) {
          meshes.push(
            // Frame — protrudes outward from wall face
            <mesh key={`${key}-fr`}
                  position={[x, cy, wallFace + dir * FRAME_DEPTH / 2]}
                  material={matFrame} castShadow receiveShadow>
              <boxGeometry args={[w + FRAME_BORDER * 2, h + FRAME_BORDER * 2, FRAME_DEPTH]} />
            </mesh>,
            // Glass — recessed inside the frame
            <mesh key={`${key}-gl`}
                  position={[x, cy, wallFace + dir * (FRAME_DEPTH - GLASS_INSET)]}
                  material={matWindow}>
              <boxGeometry args={[w, h, 0.015]} />
            </mesh>,
            // Sill — horizontal ledge below the frame
            <mesh key={`${key}-si`}
                  position={[x, cy - h / 2 - SILL_H / 2,
                             wallFace + dir * (FRAME_DEPTH / 2 + SILL_EXTRA / 2)]}
                  material={matSill} castShadow>
              <boxGeometry args={[w + FRAME_BORDER * 2 + 0.06, SILL_H, FRAME_DEPTH + SILL_EXTRA]} />
            </mesh>,
          );
        } else {
          meshes.push(
            <mesh key={key} position={[x, cy, wallFace + dir * 0.05]}
                  material={matDoorEl} castShadow>
              <boxGeometry args={[w, h, 0.05]} />
            </mesh>,
          );
        }
      } else {
        const dir      = el.side === "right" ? 1 : -1;
        const wallFace = dir * halfW;   // x of outer wall face
        const z        = lengthM * frac;

        if (isWindow) {
          meshes.push(
            // Frame
            <mesh key={`${key}-fr`}
                  position={[wallFace + dir * FRAME_DEPTH / 2, cy, z]}
                  rotation={[0, Math.PI / 2, 0]}
                  material={matFrame} castShadow receiveShadow>
              <boxGeometry args={[w + FRAME_BORDER * 2, h + FRAME_BORDER * 2, FRAME_DEPTH]} />
            </mesh>,
            // Glass
            <mesh key={`${key}-gl`}
                  position={[wallFace + dir * (FRAME_DEPTH - GLASS_INSET), cy, z]}
                  rotation={[0, Math.PI / 2, 0]}
                  material={matWindow}>
              <boxGeometry args={[w, h, 0.015]} />
            </mesh>,
            // Sill
            <mesh key={`${key}-si`}
                  position={[wallFace + dir * (FRAME_DEPTH / 2 + SILL_EXTRA / 2),
                             cy - h / 2 - SILL_H / 2, z]}
                  rotation={[0, Math.PI / 2, 0]}
                  material={matSill} castShadow>
              <boxGeometry args={[w + FRAME_BORDER * 2 + 0.06, SILL_H, FRAME_DEPTH + SILL_EXTRA]} />
            </mesh>,
          );
        } else {
          meshes.push(
            <mesh key={key}
                  position={[wallFace + dir * 0.05, cy, z]}
                  rotation={[0, Math.PI / 2, 0]}
                  material={matDoorEl} castShadow>
              <boxGeometry args={[w, h, 0.05]} />
            </mesh>,
          );
        }
      }
    });
  });

  return <>{meshes}</>;
}

// ── Camera controller ─────────────────────────────────────────────────────────
function CameraController({ focusSide, lengthM, widthM }: {
  focusSide: WallSide | null | undefined; lengthM: number; widthM: number;
}) {
  const { camera } = useThree();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const controlsRef = useRef<any>(null);

  useEffect(() => {
    if (!controlsRef.current) return;
    const halfL = lengthM / 2;
    const halfW = widthM / 2;
    const D = Math.max(halfL, halfW) + 6;

    if (!focusSide) {
      camera.position.set(14, 9, 14);
      controlsRef.current.target.set(0, 1.5, 0);
    } else {
      const pos: Record<WallSide, [number, number, number]> = {
        front: [0, 3, halfL + D],
        back:  [0, 3, -(halfL + D)],
        left:  [-(halfW + D), 3, 0],
        right: [halfW + D, 3, 0],
      };
      const tgt: Record<WallSide, [number, number, number]> = {
        front: [0, 2, halfL],
        back:  [0, 2, -halfL],
        left:  [-halfW, 2, 0],
        right: [halfW, 2, 0],
      };
      camera.position.set(...pos[focusSide]);
      controlsRef.current.target.set(...tgt[focusSide]);
    }
    controlsRef.current.update();
  }, [focusSide, lengthM, widthM, camera]);

  return (
    <OrbitControls
      ref={controlsRef}
      enablePan enableZoom enableRotate
      minPolarAngle={0.1}
      maxPolarAngle={Math.PI / 2.2}
      minDistance={3}
      maxDistance={40}
    />
  );
}

// ── Viewer ───────────────────────────────────────────────────────────────────
export default function LocalGarageViewer({
  lengthMm, widthMm, doorWidthMm, doorHeightMm, roofType = "saltak",
  focusSide, addedElements = [],
}: LocalGarageViewerProps) {
  const lengthM = lengthMm / 1000;
  const widthM  = widthMm  / 1000;

  return (
    <div className="relative h-full w-full" style={{ background: "linear-gradient(to bottom, #a8c8e0 0%, #d8ecf4 50%, #edf5f9 100%)" }}>
      <Canvas
        shadows
        camera={{ position: [14, 9, 14], fov: 40 }}
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
            lengthM={lengthM}
            widthM={widthM}
            doorWidthM={doorWidthMm / 1000}
            doorHeightM={doorHeightMm / 1000}
            roofType={roofType}
          />
          <GarageElements elements={addedElements} lengthM={lengthM} widthM={widthM} />
        </Suspense>

        <CameraController focusSide={focusSide} lengthM={lengthM} widthM={widthM} />
      </Canvas>
    </div>
  );
}

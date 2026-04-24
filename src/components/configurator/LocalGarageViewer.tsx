"use client";

import { useMemo, Suspense, useEffect, useRef } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { OrbitControls, useGLTF } from "@react-three/drei";
import type { AddedElement, WallSide, ElementCategory } from "./DoorWindowAdder";

useGLTF.preload("/Vindu_100x50glb.glb");

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

// ── Colors ───────────────────────────────────────────────────────────────────
const WALL_COLOR  = "#2C3A4A";
const ROOF_COLOR  = "#e2520a";
const DOOR_COLOR  = "#F0F0EE";
const DOOR_FRAME  = "#FFFFFF";
const PANEL_LINE  = "#D8D8D6";
const WINDOW_COLOR  = "#9ECFEA";
const DOOR_EL_COLOR = "#C4A882";
const FRAME_COLOR   = "#FFFFFF";
const SILL_COLOR    = "#E0E0DE";

// Window extrusion constants
const FRAME_BORDER = 0.055;
const FRAME_DEPTH  = 0.10;
const GLASS_INSET  = 0.04;
const SILL_H       = 0.035;
const SILL_EXTRA   = 0.05;

// ── Shared helpers ────────────────────────────────────────────────────────────
function getElDims(cat: ElementCategory) {
  const w  = cat === "door" ? 0.9 : 1.0;
  const h  = cat === "door" ? 2.1
           : cat === "window1" ? 0.5
           : cat === "window2" ? 0.6 : 1.0;
  const cy = cat === "door" ? h / 2 : WALL_H * 0.55;
  return { w, h, cy };
}

interface Rect { cx: number; cy: number; w: number; h: number; }

/** Partition a wall of size wallW×wallH into solid rectangles excluding openings */
function segmentWall(wallW: number, wallH: number, openings: Rect[]): Rect[] {
  const xs = [...new Set(
    [-wallW / 2, ...openings.flatMap(o => [o.cx - o.w / 2, o.cx + o.w / 2]), wallW / 2]
  )].sort((a, b) => a - b);
  const ys = [...new Set(
    [0, ...openings.flatMap(o => [o.cy - o.h / 2, o.cy + o.h / 2]), wallH]
  )].sort((a, b) => a - b);

  const out: Rect[] = [];
  for (let i = 0; i < xs.length - 1; i++) {
    for (let j = 0; j < ys.length - 1; j++) {
      const x1 = xs[i], x2 = xs[i + 1];
      const y1 = ys[j], y2 = ys[j + 1];
      const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2;
      const w = x2 - x1, h = y2 - y1;
      const inHole = openings.some(o =>
        cx > o.cx - o.w / 2 + 0.001 && cx < o.cx + o.w / 2 - 0.001 &&
        cy > o.cy - o.h / 2 + 0.001 && cy < o.cy + o.h / 2 - 0.001,
      );
      if (!inHole && w > 0.001 && h > 0.001) out.push({ cx, cy, w, h });
    }
  }
  return out;
}

/** Compute openings on a named wall from elements */
function wallOpenings(
  side: WallSide, elements: AddedElement[],
  widthM: number, lengthM: number,
  doorWidthM: number, doorHeightM: number,
): Rect[] {
  const openings: Rect[] = [];

  if (side === "front") {
    // always include garage door
    openings.push({ cx: 0, cy: doorHeightM / 2, w: doorWidthM, h: doorHeightM });
  }

  elements
    .filter(e => e.side === side)
    .forEach(e => {
      const { w, h, cy } = getElDims(e.category);
      const fracs =
        e.placement === "both"  ? [-0.25, 0.25]
        : e.placement === "left"  ? [0.25]
        : [-0.25];
      const wallSpan = (side === "front" || side === "back") ? widthM : lengthM;
      fracs.forEach(frac => openings.push({ cx: wallSpan * frac, cy, w, h }));
    });

  return openings;
}

// ── Gable end ─────────────────────────────────────────────────────────────────
function GableEnd({ z, halfW, ridgeH, flip = false }: {
  z: number; halfW: number; ridgeH: number; flip?: boolean;
}) {
  const shape = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(-halfW, 0); s.lineTo(halfW, 0); s.lineTo(0, ridgeH); s.closePath();
    return s;
  }, [halfW, ridgeH]);
  const extrudeSettings = useMemo(() => ({ depth: WALL_T, bevelEnabled: false }), []);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: WALL_COLOR, roughness: 0.85, metalness: 0 }), []);

  return (
    <mesh position={[0, WALL_H, z]} rotation={flip ? [0, Math.PI, 0] : [0, 0, 0]} material={mat} castShadow receiveShadow>
      <extrudeGeometry args={[shape, extrudeSettings]} />
    </mesh>
  );
}

// ── Garage geometry with wall holes ──────────────────────────────────────────
function GarageGeometry({ lengthM, widthM, doorWidthM, doorHeightM, roofType = "saltak", elements }: {
  lengthM: number; widthM: number; doorWidthM: number; doorHeightM: number;
  roofType?: "saltak" | "flattak"; elements: AddedElement[];
}) {
  const H     = WALL_H;
  const T     = WALL_T;
  const halfW = widthM  / 2;
  const halfL = lengthM / 2;

  const ridgeH   = halfW * Math.tan(ROOF_ANGLE);
  const slopeLen = halfW / Math.cos(ROOF_ANGLE);
  const roofL    = lengthM + OVERHANG * 2;
  const slopeCY  = H + ridgeH / 2;

  const PANELS = 4;
  const panelH = doorHeightM / PANELS;

  const matWall = useMemo(() => new THREE.MeshStandardMaterial({ color: WALL_COLOR, roughness: 0.85, metalness: 0 }), []);
  const matRoof = useMemo(() => new THREE.MeshStandardMaterial({ color: ROOF_COLOR, roughness: 0.7, metalness: 0 }), []);
  const matDoorPanel = useMemo(() => new THREE.MeshStandardMaterial({ color: DOOR_COLOR, roughness: 0.5, metalness: 0 }), []);
  const matDoorFrame = useMemo(() => new THREE.MeshStandardMaterial({ color: DOOR_FRAME, roughness: 0.45, metalness: 0 }), []);
  const matPanelLine = useMemo(() => new THREE.MeshStandardMaterial({ color: PANEL_LINE, roughness: 0.5, metalness: 0 }), []);

  // Compute wall segments
  const frontSegs = segmentWall(widthM, H, wallOpenings("front", elements, widthM, lengthM, doorWidthM, doorHeightM));
  const backSegs  = segmentWall(widthM, H, wallOpenings("back",  elements, widthM, lengthM, doorWidthM, doorHeightM));
  const leftSegs  = segmentWall(lengthM, H, wallOpenings("left", elements, widthM, lengthM, doorWidthM, doorHeightM));
  const rightSegs = segmentWall(lengthM, H, wallOpenings("right", elements, widthM, lengthM, doorWidthM, doorHeightM));

  return (
    <group>
      {/* ── Back wall ────────────────────────────────────────── */}
      {backSegs.map((r, i) => (
        <mesh key={`bk${i}`} position={[r.cx, r.cy, -halfL + T / 2]} material={matWall} castShadow receiveShadow>
          <boxGeometry args={[r.w, r.h, T]} />
        </mesh>
      ))}
      {roofType === "saltak" && <GableEnd z={-halfL} halfW={halfW} ridgeH={ridgeH} flip={false} />}

      {/* ── Left wall ────────────────────────────────────────── */}
      {leftSegs.map((r, i) => (
        <mesh key={`lf${i}`} position={[-halfW + T / 2, r.cy, r.cx]} material={matWall} castShadow receiveShadow>
          <boxGeometry args={[T, r.h, r.w]} />
        </mesh>
      ))}

      {/* ── Right wall ───────────────────────────────────────── */}
      {rightSegs.map((r, i) => (
        <mesh key={`rt${i}`} position={[halfW - T / 2, r.cy, r.cx]} material={matWall} castShadow receiveShadow>
          <boxGeometry args={[T, r.h, r.w]} />
        </mesh>
      ))}

      {/* ── Front wall ───────────────────────────────────────── */}
      {frontSegs.map((r, i) => (
        <mesh key={`fr${i}`} position={[r.cx, r.cy, halfL - T / 2]} material={matWall} castShadow receiveShadow>
          <boxGeometry args={[r.w, r.h, T]} />
        </mesh>
      ))}
      {roofType === "saltak" && <GableEnd z={halfL} halfW={halfW} ridgeH={ridgeH} flip={true} />}

      {/* ── Garage door frame ────────────────────────────────── */}
      <mesh position={[0, doorHeightM / 2, halfL - T / 2 + 0.01]} material={matDoorFrame} castShadow>
        <boxGeometry args={[doorWidthM + 0.10, doorHeightM + 0.08, 0.04]} />
      </mesh>

      {/* ── Garage door panels ───────────────────────────────── */}
      {Array.from({ length: PANELS }).map((_, i) => (
        <mesh key={i} position={[0, i * panelH + panelH / 2, halfL - T / 2 + 0.03]} material={matDoorPanel} castShadow>
          <boxGeometry args={[doorWidthM - 0.02, panelH - 0.04, 0.03]} />
        </mesh>
      ))}

      {/* ── Panel dividers ───────────────────────────────────── */}
      {Array.from({ length: PANELS - 1 }).map((_, i) => (
        <mesh key={i} position={[0, (i + 1) * panelH, halfL - T / 2 + 0.045]} material={matPanelLine}>
          <boxGeometry args={[doorWidthM - 0.02, 0.025, 0.01]} />
        </mesh>
      ))}

      {roofType === "saltak" ? (
        <>
          <mesh position={[-halfW / 2, slopeCY, 0]} rotation={[0, 0, ROOF_ANGLE]} material={matRoof} castShadow receiveShadow>
            <boxGeometry args={[slopeLen + 0.05, ROOF_T, roofL]} />
          </mesh>
          <mesh position={[halfW / 2, slopeCY, 0]} rotation={[0, 0, -ROOF_ANGLE]} material={matRoof} castShadow receiveShadow>
            <boxGeometry args={[slopeLen + 0.05, ROOF_T, roofL]} />
          </mesh>
        </>
      ) : (
        <mesh position={[0, H + ROOF_T / 2, 0]} material={matRoof} castShadow receiveShadow>
          <boxGeometry args={[widthM, ROOF_T, lengthM]} />
        </mesh>
      )}
    </group>
  );
}

// ── Window 100×50 GLB model ───────────────────────────────────────────────────
function WindowGLBInner({ position, rotY }: { position: [number, number, number]; rotY: number }) {
  const { scene } = useGLTF("/Vindu_100x50glb.glb");

  const group = useMemo(() => {
    const clone = scene.clone(true);
    const box = new THREE.Box3().setFromObject(clone);
    const size = new THREE.Vector3();
    box.getSize(size);

    if (size.x > 0.001 && size.y > 0.001) {
      const sx = 1.0 / size.x;
      const sy = 0.5 / size.y;
      const sz = size.z > 0.001 ? (WALL_T * 3) / size.z : 1;
      clone.scale.set(sx, sy, sz);
    }

    // Center clone within a group — position prop sets group location, not clone
    const box2 = new THREE.Box3().setFromObject(clone);
    const center = new THREE.Vector3();
    box2.getCenter(center);
    clone.position.sub(center);

    clone.traverse(child => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    const g = new THREE.Group();
    g.add(clone);
    return g;
  }, [scene]);

  return <primitive object={group} position={position} rotation={[0, rotY, 0]} />;
}

function WindowGLB({ position, rotY }: { position: [number, number, number]; rotY: number }) {
  return (
    <Suspense fallback={null}>
      <WindowGLBInner position={position} rotY={rotY} />
    </Suspense>
  );
}

// ── Added elements renderer ───────────────────────────────────────────────────
function GarageElements({ elements, lengthM, widthM }: {
  elements: AddedElement[]; lengthM: number; widthM: number;
}) {
  const halfL = lengthM / 2;
  const halfW = widthM  / 2;

  const matWindow = useMemo(() => new THREE.MeshStandardMaterial({ color: WINDOW_COLOR, roughness: 0.05, metalness: 0.3 }), []);
  const matDoorEl = useMemo(() => new THREE.MeshStandardMaterial({ color: DOOR_EL_COLOR, roughness: 0.6 }), []);
  const matFrame  = useMemo(() => new THREE.MeshStandardMaterial({ color: FRAME_COLOR, roughness: 0.5 }), []);
  const matSill   = useMemo(() => new THREE.MeshStandardMaterial({ color: SILL_COLOR, roughness: 0.55 }), []);

  const meshes: React.ReactNode[] = [];

  elements.forEach((el, idx) => {
    const { w, h, cy } = getElDims(el.category);
    const isWindow = el.category !== "door";
    const isGLBWindow = el.category === "window1";

    const fracs =
      el.placement === "both"  ? [-0.25, 0.25]
      : el.placement === "left"  ? [0.25]
      : [-0.25];

    fracs.forEach((frac, pi) => {
      const key = `${idx}-${pi}`;

      if (el.side === "front" || el.side === "back") {
        const dir      = el.side === "front" ? 1 : -1;
        const wallFace = dir * halfL;
        const wallCz   = dir * (halfL - WALL_T / 2);
        const x        = widthM * frac;
        const rotY     = el.side === "back" ? Math.PI : 0;

        if (isGLBWindow) {
          meshes.push(<WindowGLB key={key} position={[x, cy, wallCz]} rotY={rotY} />);
        } else if (isWindow) {
          meshes.push(
            <mesh key={`${key}-fr`} position={[x, cy, wallFace + dir * FRAME_DEPTH / 2]} material={matFrame} castShadow receiveShadow>
              <boxGeometry args={[w + FRAME_BORDER * 2, h + FRAME_BORDER * 2, FRAME_DEPTH]} />
            </mesh>,
            <mesh key={`${key}-gl`} position={[x, cy, wallFace + dir * (FRAME_DEPTH - GLASS_INSET)]} material={matWindow}>
              <boxGeometry args={[w, h, 0.015]} />
            </mesh>,
            <mesh key={`${key}-si`} position={[x, cy - h / 2 - SILL_H / 2, wallFace + dir * (FRAME_DEPTH / 2 + SILL_EXTRA / 2)]} material={matSill} castShadow>
              <boxGeometry args={[w + FRAME_BORDER * 2 + 0.06, SILL_H, FRAME_DEPTH + SILL_EXTRA]} />
            </mesh>,
          );
        } else {
          meshes.push(
            <mesh key={key} position={[x, cy, wallFace + dir * 0.05]} material={matDoorEl} castShadow>
              <boxGeometry args={[w, h, 0.05]} />
            </mesh>,
          );
        }
      } else {
        const dir      = el.side === "right" ? 1 : -1;
        const wallFace = dir * halfW;
        const wallCx   = dir * (halfW - WALL_T / 2);
        const z        = lengthM * frac;
        const rotY     = el.side === "right" ? -Math.PI / 2 : Math.PI / 2;

        if (isGLBWindow) {
          meshes.push(<WindowGLB key={key} position={[wallCx, cy, z]} rotY={rotY} />);
        } else if (isWindow) {
          meshes.push(
            <mesh key={`${key}-fr`} position={[wallFace + dir * FRAME_DEPTH / 2, cy, z]} rotation={[0, Math.PI / 2, 0]} material={matFrame} castShadow receiveShadow>
              <boxGeometry args={[w + FRAME_BORDER * 2, h + FRAME_BORDER * 2, FRAME_DEPTH]} />
            </mesh>,
            <mesh key={`${key}-gl`} position={[wallFace + dir * (FRAME_DEPTH - GLASS_INSET), cy, z]} rotation={[0, Math.PI / 2, 0]} material={matWindow}>
              <boxGeometry args={[w, h, 0.015]} />
            </mesh>,
            <mesh key={`${key}-si`} position={[wallFace + dir * (FRAME_DEPTH / 2 + SILL_EXTRA / 2), cy - h / 2 - SILL_H / 2, z]} rotation={[0, Math.PI / 2, 0]} material={matSill} castShadow>
              <boxGeometry args={[w + FRAME_BORDER * 2 + 0.06, SILL_H, FRAME_DEPTH + SILL_EXTRA]} />
            </mesh>,
          );
        } else {
          meshes.push(
            <mesh key={key} position={[wallFace + dir * 0.05, cy, z]} rotation={[0, Math.PI / 2, 0]} material={matDoorEl} castShadow>
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
        front: [0, 3, halfL + D], back: [0, 3, -(halfL + D)],
        left: [-(halfW + D), 3, 0], right: [halfW + D, 3, 0],
      };
      const tgt: Record<WallSide, [number, number, number]> = {
        front: [0, 2, halfL], back: [0, 2, -halfL],
        left: [-halfW, 2, 0], right: [halfW, 2, 0],
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
      minPolarAngle={0.1} maxPolarAngle={Math.PI / 2.2}
      minDistance={3} maxDistance={40}
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
          position={[12, 20, 10]} intensity={1.5} castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-28} shadow-camera-right={28}
          shadow-camera-top={28} shadow-camera-bottom={-28}
          shadow-camera-near={0.5} shadow-camera-far={90}
        />
        <directionalLight position={[-6, 4, -6]} intensity={0.22} />

        <Suspense fallback={null}>
          <GarageGeometry
            lengthM={lengthM} widthM={widthM}
            doorWidthM={doorWidthMm / 1000} doorHeightM={doorHeightMm / 1000}
            roofType={roofType} elements={addedElements}
          />
          <GarageElements elements={addedElements} lengthM={lengthM} widthM={widthM} />
        </Suspense>

        <CameraController focusSide={focusSide} lengthM={lengthM} widthM={widthM} />
      </Canvas>
    </div>
  );
}

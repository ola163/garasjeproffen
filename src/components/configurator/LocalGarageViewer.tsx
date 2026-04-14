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

// ── Dimensions ───────────────────────────────────────────────────────────────
const WALL_H     = 3.0;
const WALL_T     = 0.10;
const ROOF_T     = 0.09;
const OVERHANG   = 0.45;
const ROOF_ANGLE = 22 * (Math.PI / 180);
const BOARD_W    = 0.145;   // 145 mm stående kledning

// ── Colors ───────────────────────────────────────────────────────────────────
const BOARD_FACE_COLOR = "#e2520a";
const DOOR_COLOR       = "#FFFFFF";
const FLOOR_COLOR      = "#e5e2de";
const TILE_COLOR       = "#e2520a";

// ── Stående kledning texture ──────────────────────────────────────────────────
// Canvas width = one board (145 mm).  Canvas is kept very short in V so the
// vertical repeat introduces no visible horizontal banding pattern.
// Groove colour deliberately stays in the same brown family – just a narrow
// shadow line at the edge, not jet-black.
function buildCladdingTexture(): THREE.CanvasTexture {
  const W = 256, H = 4;
  // Groove occupies the rightmost GAP pixels (≈ 10 mm recessed joint)
  const GAP = 18;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // 1. Full canvas: board face colour
  ctx.fillStyle = BOARD_FACE_COLOR;
  ctx.fillRect(0, 0, W, H);

  // 2. Left chamfer highlight (the "nose" of the board catching light)
  ctx.fillStyle = "rgba(255,255,255,0.16)";
  ctx.fillRect(0, 0, 4, H);

  // 3. Groove area – same board colour but slightly darker (recessed shadow)
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.fillRect(W - GAP, 0, GAP, H);

  // 4. Sharp shadow at the groove edge (the hard shadow cast by the board nose)
  ctx.fillStyle = "rgba(0,0,0,0.42)";
  ctx.fillRect(W - GAP, 0, 3, H);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.anisotropy = 4;
  return tex;
}

// ── Roof tile texture ─────────────────────────────────────────────────────────
function buildTileTexture(): THREE.CanvasTexture {
  const W = 128, H = 128;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = TILE_COLOR;
  ctx.fillRect(0, 0, W, H);

  const bodyGrad = ctx.createLinearGradient(0, 0, W, H);
  bodyGrad.addColorStop(0, "rgba(255,255,255,0.06)");
  bodyGrad.addColorStop(1, "rgba(0,0,0,0.12)");
  ctx.fillStyle = bodyGrad;
  ctx.fillRect(0, 0, W, H);

  const topShad = ctx.createLinearGradient(0, 0, 0, H * 0.22);
  topShad.addColorStop(0, "rgba(0,0,0,0.55)");
  topShad.addColorStop(1, "rgba(0,0,0,0.0)");
  ctx.fillStyle = topShad;
  ctx.fillRect(0, 0, W, H * 0.22);

  const btmLight = ctx.createLinearGradient(0, H * 0.82, 0, H);
  btmLight.addColorStop(0, "rgba(255,255,255,0.0)");
  btmLight.addColorStop(1, "rgba(255,255,255,0.10)");
  ctx.fillStyle = btmLight;
  ctx.fillRect(0, H * 0.82, W, H);

  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(0, 0, 3, H);
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.fillRect(W - 3, 0, 3, H);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.anisotropy = 4;
  return tex;
}

// ── Cladding material ────────────────────────────────────────────────────────
// repeat.y = 1  →  texture spans the full wall height once, no horizontal
// banding.  repeat.x = number of boards across the wall width.
function makeWallMat(base: THREE.CanvasTexture, wallWidthM: number) {
  const t = base.clone();
  t.repeat.set(Math.max(1, wallWidthM / BOARD_W), 1);
  t.needsUpdate = true;
  return new THREE.MeshStandardMaterial({ map: t, roughness: 0.9, metalness: 0 });
}

// ── Gable end with proper wall thickness ─────────────────────────────────────
// Uses ExtrudeGeometry so the gable has the same WALL_T thickness as the
// rectangular walls, giving a consistent profile everywhere.
// "flip=true" extrudes toward -Z (used for the front gable).
function GableEnd({ z, halfW, ridgeH, mat, flip = false }: {
  z: number; halfW: number; ridgeH: number;
  mat: THREE.Material; flip?: boolean;
}) {
  const shape = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(-halfW, 0);
    s.lineTo( halfW, 0);
    s.lineTo(0, ridgeH);
    s.closePath();
    return s;
  }, [halfW, ridgeH]);

  const extrudeSettings = useMemo(
    () => ({ depth: WALL_T, bevelEnabled: false }),
    []
  );

  return (
    <mesh
      position={[0, WALL_H, z]}
      rotation={flip ? [0, Math.PI, 0] : [0, 0, 0]}
      material={mat}
      castShadow
      receiveShadow
    >
      <extrudeGeometry args={[shape, extrudeSettings]} />
    </mesh>
  );
}

// ── Full garage geometry ──────────────────────────────────────────────────────
function GarageGeometry({
  lengthM, widthM, doorWidthM, doorHeightM,
}: {
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

  const PANELS = 5;
  const panelH = doorHeightM / PANELS;

  // ── Textures ──────────────────────────────────────────────────────────────
  const baseTex = useMemo(buildCladdingTexture, []);
  const tileTex = useMemo(buildTileTexture, []);

  // All cladding materials share repeat.y = 1 so boards show no horizontal banding
  const matBack   = useMemo(() => makeWallMat(baseTex, widthM),     [baseTex, widthM]);
  const matSide   = useMemo(() => makeWallMat(baseTex, lengthM),    [baseTex, lengthM]);
  const matPier   = useMemo(() => makeWallMat(baseTex, sideW),      [baseTex, sideW]);
  const matLintel = useMemo(() => makeWallMat(baseTex, doorWidthM), [baseTex, doorWidthM]);
  // Gable uses same widthM repeat so board grooves line up with the wall below
  const matGable  = useMemo(() => makeWallMat(baseTex, widthM),     [baseTex, widthM]);

  const matTile = useMemo(() => {
    const t = tileTex.clone();
    t.repeat.set(slopeLen / 0.30, roofL / 0.32);
    t.needsUpdate = true;
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.75, metalness: 0.05 });
  }, [tileTex, slopeLen, roofL]);

  const matDoor = useMemo(() =>
    new THREE.MeshStandardMaterial({ color: DOOR_COLOR, roughness: 0.35, metalness: 0.05 }), []);
  const matFloor = useMemo(() =>
    new THREE.MeshStandardMaterial({ color: FLOOR_COLOR, roughness: 0.9 }), []);

  return (
    <group>
      {/* ── Floor ──────────────────────────────────────────────────── */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]}
            material={matFloor} receiveShadow>
        <planeGeometry args={[widthM - T * 2, lengthM - T * 2]} />
      </mesh>

      {/* ── Back wall (rectangle) ──────────────────────────────────── */}
      <mesh position={[0, H / 2, -halfL + T / 2]}
            material={matBack} castShadow receiveShadow>
        <boxGeometry args={[widthM, H, T]} />
      </mesh>

      {/* ── Back gable (triangle, same thickness T, outer face at -halfL) */}
      <GableEnd z={-halfL} halfW={halfW} ridgeH={ridgeH} mat={matGable} flip={false} />

      {/* ── Left wall ──────────────────────────────────────────────── */}
      <mesh position={[-halfW + T / 2, H / 2, 0]}
            material={matSide} castShadow receiveShadow>
        <boxGeometry args={[T, H, lengthM]} />
      </mesh>

      {/* ── Right wall ─────────────────────────────────────────────── */}
      <mesh position={[halfW - T / 2, H / 2, 0]}
            material={matSide} castShadow receiveShadow>
        <boxGeometry args={[T, H, lengthM]} />
      </mesh>

      {/* ── Front – left pier (VeggC) ──────────────────────────────── */}
      {sideW > 0.01 && (
        <mesh position={[-halfW + sideW / 2, H / 2, halfL - T / 2]}
              material={matPier} castShadow receiveShadow>
          <boxGeometry args={[sideW, H, T]} />
        </mesh>
      )}

      {/* ── Front – right pier (VeggC) ─────────────────────────────── */}
      {sideW > 0.01 && (
        <mesh position={[halfW - sideW / 2, H / 2, halfL - T / 2]}
              material={matPier} castShadow receiveShadow>
          <boxGeometry args={[sideW, H, T]} />
        </mesh>
      )}

      {/* ── Front – lintel above door ───────────────────────────────── */}
      {aboveDoor > 0.02 && (
        <mesh position={[0, doorHeightM + aboveDoor / 2, halfL - T / 2]}
              material={matLintel} castShadow receiveShadow>
          <boxGeometry args={[doorWidthM, aboveDoor, T]} />
        </mesh>
      )}

      {/* ── Front gable (triangle, outer face at +halfL, extrudes inward) */}
      <GableEnd z={halfL} halfW={halfW} ridgeH={ridgeH} mat={matGable} flip={true} />

      {/* ── Garage door panels ─────────────────────────────────────── */}
      {Array.from({ length: PANELS }).map((_, i) => (
        <mesh key={i}
              position={[0, i * panelH + panelH / 2, halfL - T / 2 + 0.006]}
              material={matDoor}>
          <boxGeometry args={[doorWidthM - 0.06, panelH - 0.05, 0.03]} />
        </mesh>
      ))}

      {/* ── Left roof slope ──────────────────────────────────────────── */}
      <mesh position={[-halfW / 2, slopeCY, 0]}
            rotation={[0, 0, ROOF_ANGLE]}
            material={matTile} castShadow receiveShadow>
        <boxGeometry args={[slopeLen, ROOF_T, roofL]} />
      </mesh>

      {/* ── Right roof slope ─────────────────────────────────────────── */}
      <mesh position={[halfW / 2, slopeCY, 0]}
            rotation={[0, 0, -ROOF_ANGLE]}
            material={matTile} castShadow receiveShadow>
        <boxGeometry args={[slopeLen, ROOF_T, roofL]} />
      </mesh>

      {/* Ridge cap removed — the two slopes meet cleanly at the apex */}
    </group>
  );
}

// ── Viewer ───────────────────────────────────────────────────────────────────
export default function LocalGarageViewer({
  lengthMm, widthMm, doorWidthMm, doorHeightMm,
}: LocalGarageViewerProps) {
  return (
    <div className="relative h-full w-full">
      <Canvas
        shadows
        camera={{ position: [14, 8, 14], fov: 40 }}
        gl={{ toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
      >
        <color attach="background" args={["#f5f5f4"]} />
        <ambientLight intensity={0.45} />
        <directionalLight
          position={[12, 18, 10]}
          intensity={1.6}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-24}
          shadow-camera-right={24}
          shadow-camera-top={24}
          shadow-camera-bottom={-24}
          shadow-camera-near={0.5}
          shadow-camera-far={80}
        />
        <directionalLight position={[-8, 5, -8]} intensity={0.25} />

        <Suspense fallback={null}>
          <GarageGeometry
            lengthM={lengthMm / 1000}
            widthM={widthMm / 1000}
            doorWidthM={doorWidthMm / 1000}
            doorHeightM={doorHeightMm / 1000}
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

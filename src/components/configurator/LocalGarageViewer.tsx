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

// ── Constants ────────────────────────────────────────────────────────────────
const WALL_H     = 3.0;
const WALL_T     = 0.12;
const ROOF_T     = 0.10;
const OVERHANG   = 0.55;           // roof overhang at eave
const ROOF_ANGLE = 36 * (Math.PI / 180); // 36° steep pitch (matches reference)
const BOARD_H    = 0.14;           // 140 mm liggende kledning

// ── Colors (from reference image) ───────────────────────────────────────────
const WALL_DARK   = "#353A3C";  // dark charcoal walls
const ROOF_DARK   = "#1A1C1D";  // near-black roof tiles
const GDR_COLOR   = "#AFC2C8";  // light blue-gray garage door
const TRIM_WHITE  = "#F5F5F5";  // white trim / pedestrian door
const GLASS_COLOR = "#9BBDCC";  // window glass (slightly blue)
const FASCIA_COL  = "#222526";  // dark fascia boards
const FLOOR_COLOR = "#D8D5D0";  // concrete floor

// ── Liggende kledning (horizontal board) texture ─────────────────────────────
function buildCladdingTexture(): THREE.CanvasTexture {
  const W = 64, H = 64;
  const SHADOW = Math.floor(H * 0.18);
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // Board face – dark charcoal
  ctx.fillStyle = WALL_DARK;
  ctx.fillRect(0, 0, W, H - SHADOW);

  // Subtle horizontal grain
  for (let y = 6; y < H - SHADOW; y += 10) {
    ctx.fillStyle = "rgba(255,255,255,0.025)";
    ctx.fillRect(0, y, W, 1);
  }

  // Top edge: slight lighter highlight (exposed board edge)
  ctx.fillStyle = "rgba(255,255,255,0.10)";
  ctx.fillRect(0, 0, W, 3);

  // Bottom shadow (board overlaps the one below)
  const shad = ctx.createLinearGradient(0, H - SHADOW, 0, H);
  shad.addColorStop(0, "rgba(0,0,0,0.0)");
  shad.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.fillStyle = shad;
  ctx.fillRect(0, H - SHADOW, W, SHADOW);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.anisotropy = 4;
  return tex;
}

// ── Roof tile texture (dark panner) ──────────────────────────────────────────
function buildTileTexture(): THREE.CanvasTexture {
  const W = 128, H = 128;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = ROOF_DARK;
  ctx.fillRect(0, 0, W, H);

  // Slight variation
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, "rgba(255,255,255,0.04)");
  grad.addColorStop(1, "rgba(0,0,0,0.08)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Top shadow from overlapping tile
  const top = ctx.createLinearGradient(0, 0, 0, H * 0.22);
  top.addColorStop(0, "rgba(0,0,0,0.6)");
  top.addColorStop(1, "rgba(0,0,0,0.0)");
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, W, H * 0.22);

  // Bottom highlight
  const btm = ctx.createLinearGradient(0, H * 0.8, 0, H);
  btm.addColorStop(0, "rgba(255,255,255,0.0)");
  btm.addColorStop(1, "rgba(255,255,255,0.07)");
  ctx.fillStyle = btm;
  ctx.fillRect(0, H * 0.8, W, H);

  // Vertical joint
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.fillRect(0, 0, 2, H);
  ctx.fillStyle = "rgba(255,255,255,0.06)";
  ctx.fillRect(W - 2, 0, 2, H);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.anisotropy = 4;
  return tex;
}

// ── Per-wall cladding material ────────────────────────────────────────────────
// Horizontal boards: repeat along Y (height), not X
function makeWallMat(base: THREE.CanvasTexture, wallHeightM: number) {
  const t = base.clone();
  t.repeat.set(1, wallHeightM / BOARD_H);
  t.needsUpdate = true;
  return new THREE.MeshStandardMaterial({ map: t, roughness: 0.92, metalness: 0 });
}

// ── Window ────────────────────────────────────────────────────────────────────
function Window({ position, width, height, rotY = 0 }: {
  position: [number, number, number];
  width: number;
  height: number;
  rotY?: number;
}) {
  const matFrame = useMemo(() => new THREE.MeshStandardMaterial({ color: TRIM_WHITE, roughness: 0.5 }), []);
  const matGlass = useMemo(() => new THREE.MeshStandardMaterial({
    color: GLASS_COLOR, transparent: true, opacity: 0.72,
    roughness: 0.05, metalness: 0.2,
  }), []);

  return (
    <group position={position} rotation={[0, rotY, 0]}>
      {/* Outer frame */}
      <mesh material={matFrame} castShadow>
        <boxGeometry args={[width + 0.12, height + 0.12, 0.07]} />
      </mesh>
      {/* Glass */}
      <mesh position={[0, 0, 0.025]} material={matGlass}>
        <planeGeometry args={[width - 0.06, height - 0.06]} />
      </mesh>
      {/* Inner cross divider (horizontal) */}
      <mesh position={[0, 0, 0.04]} material={matFrame}>
        <boxGeometry args={[width, 0.05, 0.03]} />
      </mesh>
      {/* Inner cross divider (vertical) */}
      <mesh position={[0, 0, 0.04]} material={matFrame}>
        <boxGeometry args={[0.05, height, 0.03]} />
      </mesh>
    </group>
  );
}

// ── Pedestrian door ───────────────────────────────────────────────────────────
function PedestrianDoor({ position }: { position: [number, number, number] }) {
  const DW = 0.95, DH = 2.05;
  const matFrame = useMemo(() => new THREE.MeshStandardMaterial({ color: TRIM_WHITE, roughness: 0.5 }), []);
  const matDoor  = useMemo(() => new THREE.MeshStandardMaterial({ color: TRIM_WHITE, roughness: 0.45 }), []);

  return (
    <group position={position}>
      {/* Frame */}
      <mesh material={matFrame} castShadow>
        <boxGeometry args={[DW + 0.14, DH + 0.10, 0.08]} />
      </mesh>
      {/* Door panel */}
      <mesh position={[0, 0, 0.03]} material={matDoor}>
        <boxGeometry args={[DW - 0.02, DH - 0.04, 0.05]} />
      </mesh>
      {/* Upper panel inset */}
      <mesh position={[0, DH * 0.28, 0.06]} material={matFrame}>
        <boxGeometry args={[DW * 0.7, DH * 0.38, 0.02]} />
      </mesh>
      {/* Lower panel inset */}
      <mesh position={[0, -DH * 0.2, 0.06]} material={matFrame}>
        <boxGeometry args={[DW * 0.7, DH * 0.3, 0.02]} />
      </mesh>
      {/* Handle */}
      <mesh position={[DW * 0.33, 0, 0.10]} material={matFrame}>
        <cylinderGeometry args={[0.015, 0.015, 0.12, 8]} />
      </mesh>
    </group>
  );
}

// ── Gable end with cladding + loft window ────────────────────────────────────
function GableEnd({ z, halfW, ridgeH, mat, showWindow }: {
  z: number; halfW: number; ridgeH: number;
  mat: THREE.Material; showWindow: boolean;
}) {
  const shape = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(-halfW, 0);
    s.lineTo( halfW, 0);
    s.lineTo(0, ridgeH);
    s.closePath();
    return s;
  }, [halfW, ridgeH]);

  return (
    <group position={[0, WALL_H, z]}>
      {/* Cladding triangle */}
      <mesh material={mat} castShadow receiveShadow>
        <shapeGeometry args={[shape]} />
      </mesh>
      {/* Loft window */}
      {showWindow && (
        <Window
          position={[0, ridgeH * 0.52, 0.06]}
          width={0.75}
          height={0.75}
        />
      )}
    </group>
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
  const sideW = (widthM - doorWidthM) / 2;  // VeggC

  // Pitched roof (36°)
  const ridgeH   = halfW * Math.tan(ROOF_ANGLE);
  const slopeLen = halfW / Math.cos(ROOF_ANGLE);
  const roofL    = lengthM + OVERHANG * 2;
  const slopeCY  = H + ridgeH / 2;

  // Garage door panels
  const PANELS = 5;
  const panelH = doorHeightM / PANELS;
  const aboveDoor = H - doorHeightM;

  // ── Textures ──────────────────────────────────────────────────────────────
  const baseTex  = useMemo(buildCladdingTexture, []);
  const tileTex  = useMemo(buildTileTexture, []);

  // Wall materials (horizontal boards, repeat by height)
  const matWall   = useMemo(() => makeWallMat(baseTex, H),          [baseTex]);
  const matGable  = useMemo(() => makeWallMat(baseTex, ridgeH),     [baseTex, ridgeH]);
  const matLintel = useMemo(() => makeWallMat(baseTex, aboveDoor > 0.01 ? aboveDoor : 0.01), [baseTex, aboveDoor]);

  const matTile = useMemo(() => {
    const t = tileTex.clone();
    t.repeat.set(slopeLen / 0.30, roofL / 0.32);
    t.needsUpdate = true;
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.8, metalness: 0.05 });
  }, [tileTex, slopeLen, roofL]);

  const matGDoor = useMemo(() =>
    new THREE.MeshStandardMaterial({ color: GDR_COLOR, roughness: 0.3, metalness: 0.08 }), []);
  const matFascia = useMemo(() =>
    new THREE.MeshStandardMaterial({ color: FASCIA_COL, roughness: 0.7 }), []);
  const matFloor = useMemo(() =>
    new THREE.MeshStandardMaterial({ color: FLOOR_COLOR, roughness: 0.95 }), []);
  const matRidge = useMemo(() =>
    new THREE.MeshStandardMaterial({ color: FASCIA_COL, roughness: 0.7 }), []);

  // Pedestrian door: show in right VeggC if wide enough
  const showPedDoor = sideW >= 1.15;
  const pedDoorX    = halfW - sideW / 2;

  // Side window position on right wall
  const sideWinZ = halfL * 0.3;

  return (
    <group>
      {/* ── Floor ────────────────────────────────────────────────── */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]} material={matFloor} receiveShadow>
        <planeGeometry args={[widthM - T * 2, lengthM - T * 2]} />
      </mesh>

      {/* ── Back wall ────────────────────────────────────────────── */}
      <mesh position={[0, H / 2, -halfL + T / 2]} material={matWall} castShadow receiveShadow>
        <boxGeometry args={[widthM, H, T]} />
      </mesh>

      {/* ── Left wall ────────────────────────────────────────────── */}
      <mesh position={[-halfW + T / 2, H / 2, 0]} material={matWall} castShadow receiveShadow>
        <boxGeometry args={[T, H, lengthM]} />
      </mesh>

      {/* ── Right wall ───────────────────────────────────────────── */}
      <mesh position={[halfW - T / 2, H / 2, 0]} material={matWall} castShadow receiveShadow>
        <boxGeometry args={[T, H, lengthM]} />
      </mesh>

      {/* ── Side window on right wall ────────────────────────────── */}
      <Window
        position={[halfW, H * 0.55, sideWinZ]}
        width={0.85}
        height={0.45}
        rotY={Math.PI / 2}
      />

      {/* ── Front – left pier (VeggC) ────────────────────────────── */}
      {sideW > 0.01 && (
        <mesh position={[-halfW + sideW / 2, H / 2, halfL - T / 2]} material={matWall} castShadow receiveShadow>
          <boxGeometry args={[sideW, H, T]} />
        </mesh>
      )}

      {/* ── Front – right pier (VeggC, minus ped door area) ─────── */}
      {sideW > 0.01 && !showPedDoor && (
        <mesh position={[halfW - sideW / 2, H / 2, halfL - T / 2]} material={matWall} castShadow receiveShadow>
          <boxGeometry args={[sideW, H, T]} />
        </mesh>
      )}
      {sideW > 0.01 && showPedDoor && (
        <>
          {/* Wall above ped door */}
          <mesh position={[pedDoorX, H - 0.475, halfL - T / 2]} material={matWall} castShadow receiveShadow>
            <boxGeometry args={[sideW, H * 0.05 + 0.9, T]} />
          </mesh>
          {/* Wall beside ped door – left strip */}
          <mesh position={[pedDoorX - 0.545, H / 2, halfL - T / 2]} material={matWall} castShadow receiveShadow>
            <boxGeometry args={[sideW - 1.09, H, T]} />
          </mesh>
        </>
      )}

      {/* ── Front – lintel above garage door ─────────────────────── */}
      {aboveDoor > 0.02 && (
        <mesh position={[0, doorHeightM + aboveDoor / 2, halfL - T / 2]} material={matLintel} castShadow receiveShadow>
          <boxGeometry args={[doorWidthM, aboveDoor, T]} />
        </mesh>
      )}

      {/* ── Gable ends (cladding + loft window on front) ─────────── */}
      <GableEnd z={-halfL + T / 2} halfW={halfW} ridgeH={ridgeH} mat={matGable} showWindow={false} />
      <GableEnd z={ halfL - T / 2} halfW={halfW} ridgeH={ridgeH} mat={matGable} showWindow />

      {/* ── Garage door – segmented panels (light blue) ──────────── */}
      {Array.from({ length: PANELS }).map((_, i) => (
        <mesh key={i}
              position={[0, i * panelH + panelH / 2, halfL - T / 2 + 0.008]}
              material={matGDoor}>
          <boxGeometry args={[doorWidthM - 0.06, panelH - 0.04, 0.04]} />
        </mesh>
      ))}

      {/* Garage door white frame */}
      <mesh position={[0, doorHeightM / 2, halfL - T / 2 + 0.005]}>
        <boxGeometry args={[doorWidthM + 0.10, doorHeightM + 0.10, 0.04]} />
        <meshStandardMaterial color={TRIM_WHITE} roughness={0.5} />
      </mesh>

      {/* ── Pedestrian door ──────────────────────────────────────── */}
      {showPedDoor && (
        <PedestrianDoor position={[pedDoorX, 1.075, halfL - T / 2 + 0.01]} />
      )}

      {/* ── Fascia boards at eave (dark strip under roof edge) ───── */}
      {/* Left eave */}
      <mesh position={[-halfW, H - 0.12, 0]} material={matFascia} castShadow>
        <boxGeometry args={[0.03, 0.24, roofL]} />
      </mesh>
      {/* Right eave */}
      <mesh position={[halfW, H - 0.12, 0]} material={matFascia} castShadow>
        <boxGeometry args={[0.03, 0.24, roofL]} />
      </mesh>
      {/* Front verge */}
      <mesh position={[0, slopeCY, halfL + OVERHANG]} material={matFascia} castShadow>
        <boxGeometry args={[widthM + 0.06, 0.20, 0.04]} />
      </mesh>
      {/* Back verge */}
      <mesh position={[0, slopeCY, -halfL - OVERHANG]} material={matFascia} castShadow>
        <boxGeometry args={[widthM + 0.06, 0.20, 0.04]} />
      </mesh>

      {/* ── Left roof slope ───────────────────────────────────────── */}
      <mesh position={[-halfW / 2, slopeCY, 0]} rotation={[0, 0, ROOF_ANGLE]}
            material={matTile} castShadow receiveShadow>
        <boxGeometry args={[slopeLen, ROOF_T, roofL]} />
      </mesh>

      {/* ── Right roof slope ──────────────────────────────────────── */}
      <mesh position={[halfW / 2, slopeCY, 0]} rotation={[0, 0, -ROOF_ANGLE]}
            material={matTile} castShadow receiveShadow>
        <boxGeometry args={[slopeLen, ROOF_T, roofL]} />
      </mesh>

      {/* ── Ridge cap ────────────────────────────────────────────── */}
      <mesh position={[0, H + ridgeH + ROOF_T / 2, 0]} material={matRidge} castShadow>
        <boxGeometry args={[0.16, ROOF_T, roofL]} />
      </mesh>
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
        camera={{ position: [16, 9, 16], fov: 38 }}
        gl={{ toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0 }}
      >
        <color attach="background" args={["#e8eaec"]} />
        <ambientLight intensity={0.50} />
        <directionalLight
          position={[14, 20, 12]}
          intensity={1.5}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-26}
          shadow-camera-right={26}
          shadow-camera-top={26}
          shadow-camera-bottom={-26}
          shadow-camera-near={0.5}
          shadow-camera-far={90}
        />
        <directionalLight position={[-6, 4, -8]} intensity={0.20} />

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
          args={[50, 50]}
          cellSize={1}
          cellThickness={0.5}
          cellColor="#c5c5c5"
          sectionSize={5}
          sectionThickness={1}
          sectionColor="#a0a0a0"
          fadeDistance={40}
          fadeStrength={1}
        />

        <Environment preset="city" />

        <OrbitControls
          enablePan enableZoom enableRotate
          minPolarAngle={0.05}
          maxPolarAngle={Math.PI / 2.15}
          minDistance={5}
          maxDistance={50}
        />
      </Canvas>
    </div>
  );
}

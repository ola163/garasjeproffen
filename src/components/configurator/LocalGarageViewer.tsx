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
const OVERHANG   = 0.55;
const ROOF_ANGLE = 36 * (Math.PI / 180);
const BOARD_H    = 0.14;           // 140 mm liggende kledning

// ── Colors (matching reference image) ────────────────────────────────────────
const WALL_COLOR  = "#EDE9E1";   // warm cream-white cladding
const ROOF_DARK   = "#252728";   // near-black roof tiles
const GDR_COLOR   = "#E2DDD5";   // garage door panels – slightly cooler cream
const TRIM_WHITE  = "#F8F8F8";   // window/door frames
const GLASS_COLOR = "#8AAFC2";   // window glass
const FASCIA_COL  = "#1C1E1F";   // fascia / ridge cap
const GROUND_COL  = "#7A5C42";   // earthy brown ground

// ── Liggende kledning (white horizontal board) texture ───────────────────────
function buildCladdingTexture(): THREE.CanvasTexture {
  const W = 64, H = 64;
  const SHADOW = Math.floor(H * 0.16);
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // Board face – warm white
  ctx.fillStyle = WALL_COLOR;
  ctx.fillRect(0, 0, W, H - SHADOW);

  // Very subtle horizontal grain lines
  for (let y = 8; y < H - SHADOW; y += 11) {
    ctx.fillStyle = "rgba(0,0,0,0.025)";
    ctx.fillRect(0, y, W, 1);
  }

  // Slight top highlight (exposed board edge)
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.fillRect(0, 0, W, 2);

  // Bottom shadow (board overlaps the one below)
  const shad = ctx.createLinearGradient(0, H - SHADOW, 0, H);
  shad.addColorStop(0, "rgba(0,0,0,0.0)");
  shad.addColorStop(1, "rgba(0,0,0,0.28)");
  ctx.fillStyle = shad;
  ctx.fillRect(0, H - SHADOW, W, SHADOW);

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

  ctx.fillStyle = ROOF_DARK;
  ctx.fillRect(0, 0, W, H);

  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, "rgba(255,255,255,0.04)");
  grad.addColorStop(1, "rgba(0,0,0,0.08)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  const top = ctx.createLinearGradient(0, 0, 0, H * 0.22);
  top.addColorStop(0, "rgba(0,0,0,0.6)");
  top.addColorStop(1, "rgba(0,0,0,0.0)");
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, W, H * 0.22);

  const btm = ctx.createLinearGradient(0, H * 0.8, 0, H);
  btm.addColorStop(0, "rgba(255,255,255,0.0)");
  btm.addColorStop(1, "rgba(255,255,255,0.07)");
  ctx.fillStyle = btm;
  ctx.fillRect(0, H * 0.8, W, H);

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

function makeWallMat(base: THREE.CanvasTexture, wallHeightM: number) {
  const t = base.clone();
  t.repeat.set(1, wallHeightM / BOARD_H);
  t.needsUpdate = true;
  return new THREE.MeshStandardMaterial({ map: t, roughness: 0.88, metalness: 0 });
}

// ── Window ────────────────────────────────────────────────────────────────────
function Window({ position, width, height, rotY = 0 }: {
  position: [number, number, number];
  width: number;
  height: number;
  rotY?: number;
}) {
  const matFrame = useMemo(() => new THREE.MeshStandardMaterial({ color: TRIM_WHITE, roughness: 0.45 }), []);
  const matGlass = useMemo(() => new THREE.MeshStandardMaterial({
    color: GLASS_COLOR, transparent: true, opacity: 0.75,
    roughness: 0.05, metalness: 0.15,
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
      {/* Horizontal divider */}
      <mesh position={[0, 0, 0.04]} material={matFrame}>
        <boxGeometry args={[width, 0.05, 0.03]} />
      </mesh>
      {/* Vertical divider */}
      <mesh position={[0, 0, 0.04]} material={matFrame}>
        <boxGeometry args={[0.05, height, 0.03]} />
      </mesh>
    </group>
  );
}

// ── Gable end with cladding (continuous with walls) ──────────────────────────
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
      {/* Cladding triangle – continuous with walls below */}
      <mesh material={mat} castShadow receiveShadow>
        <shapeGeometry args={[shape]} />
      </mesh>
      {/* Small loft window in gable */}
      {showWindow && (
        <Window
          position={[0, ridgeH * 0.50, 0.06]}
          width={0.70}
          height={0.70}
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
  const sideW = (widthM - doorWidthM) / 2;   // VeggC

  const ridgeH   = halfW * Math.tan(ROOF_ANGLE);
  const slopeLen = halfW / Math.cos(ROOF_ANGLE);
  const roofL    = lengthM + OVERHANG * 2;
  const slopeCY  = H + ridgeH / 2;

  const PANELS  = 5;
  const panelH  = doorHeightM / PANELS;
  const aboveDoor = H - doorHeightM;

  // ── Textures / materials ──────────────────────────────────────────────────
  const baseTex = useMemo(buildCladdingTexture, []);
  const tileTex = useMemo(buildTileTexture, []);

  const matWall   = useMemo(() => makeWallMat(baseTex, H),                              [baseTex]);
  const matGable  = useMemo(() => makeWallMat(baseTex, ridgeH),                         [baseTex, ridgeH]);
  const matLintel = useMemo(() => makeWallMat(baseTex, Math.max(aboveDoor, 0.01)),       [baseTex, aboveDoor]);

  const matTile = useMemo(() => {
    const t = tileTex.clone();
    t.repeat.set(slopeLen / 0.30, roofL / 0.32);
    t.needsUpdate = true;
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.8, metalness: 0.05 });
  }, [tileTex, slopeLen, roofL]);

  const matGDoor  = useMemo(() => new THREE.MeshStandardMaterial({ color: GDR_COLOR,   roughness: 0.35, metalness: 0.06 }), []);
  const matTrim   = useMemo(() => new THREE.MeshStandardMaterial({ color: TRIM_WHITE,   roughness: 0.45 }),                  []);
  const matFascia = useMemo(() => new THREE.MeshStandardMaterial({ color: FASCIA_COL,   roughness: 0.70 }),                  []);
  const matGround = useMemo(() => new THREE.MeshStandardMaterial({ color: GROUND_COL,   roughness: 0.95 }),                  []);

  // Side window (right wall, mid-height, rear-third)
  const sideWinZ = -halfL * 0.25;

  return (
    <group>
      {/* ── Ground patch ─────────────────────────────────────────── */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.005, 0]} material={matGround} receiveShadow>
        <planeGeometry args={[widthM + 4, lengthM + 4]} />
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
        width={0.80}
        height={0.45}
        rotY={Math.PI / 2}
      />

      {/* ── Front – left pier (VeggC) ────────────────────────────── */}
      {sideW > 0.01 && (
        <mesh position={[-halfW + sideW / 2, H / 2, halfL - T / 2]} material={matWall} castShadow receiveShadow>
          <boxGeometry args={[sideW, H, T]} />
        </mesh>
      )}

      {/* ── Front – right pier (VeggC) ──────────────────────────── */}
      {sideW > 0.01 && (
        <mesh position={[halfW - sideW / 2, H / 2, halfL - T / 2]} material={matWall} castShadow receiveShadow>
          <boxGeometry args={[sideW, H, T]} />
        </mesh>
      )}

      {/* ── Front – lintel above garage door ─────────────────────── */}
      {aboveDoor > 0.02 && (
        <mesh position={[0, doorHeightM + aboveDoor / 2, halfL - T / 2]} material={matLintel} castShadow receiveShadow>
          <boxGeometry args={[doorWidthM, aboveDoor, T]} />
        </mesh>
      )}

      {/* ── Gable ends (cladding goes all the way up) ─────────────── */}
      <GableEnd z={-halfL + T / 2} halfW={halfW} ridgeH={ridgeH} mat={matGable} showWindow={false} />
      <GableEnd z={ halfL - T / 2} halfW={halfW} ridgeH={ridgeH} mat={matGable} showWindow />

      {/* ── Garage door – segmented panels ───────────────────────── */}
      {Array.from({ length: PANELS }).map((_, i) => (
        <mesh key={i}
              position={[0, i * panelH + panelH / 2, halfL - T / 2 + 0.008]}
              material={matGDoor}>
          <boxGeometry args={[doorWidthM - 0.06, panelH - 0.03, 0.04]} />
        </mesh>
      ))}

      {/* Garage door frame */}
      <mesh position={[0, doorHeightM / 2, halfL - T / 2 + 0.005]} material={matTrim}>
        <boxGeometry args={[doorWidthM + 0.10, doorHeightM + 0.10, 0.04]} />
      </mesh>

      {/* ── Fascia boards at eave ─────────────────────────────────── */}
      <mesh position={[-halfW, H - 0.12, 0]} material={matFascia} castShadow>
        <boxGeometry args={[0.04, 0.26, roofL]} />
      </mesh>
      <mesh position={[halfW, H - 0.12, 0]} material={matFascia} castShadow>
        <boxGeometry args={[0.04, 0.26, roofL]} />
      </mesh>
      {/* Front verge board */}
      <mesh position={[0, slopeCY, halfL + OVERHANG]} material={matFascia} castShadow>
        <boxGeometry args={[widthM + 0.08, 0.22, 0.05]} />
      </mesh>
      {/* Back verge board */}
      <mesh position={[0, slopeCY, -halfL - OVERHANG]} material={matFascia} castShadow>
        <boxGeometry args={[widthM + 0.08, 0.22, 0.05]} />
      </mesh>

      {/* ── Left roof slope ──────────────────────────────────────── */}
      <mesh position={[-halfW / 2, slopeCY, 0]} rotation={[0, 0, ROOF_ANGLE]}
            material={matTile} castShadow receiveShadow>
        <boxGeometry args={[slopeLen, ROOF_T, roofL]} />
      </mesh>

      {/* ── Right roof slope ─────────────────────────────────────── */}
      <mesh position={[halfW / 2, slopeCY, 0]} rotation={[0, 0, -ROOF_ANGLE]}
            material={matTile} castShadow receiveShadow>
        <boxGeometry args={[slopeLen, ROOF_T, roofL]} />
      </mesh>

      {/* ── Ridge cap ────────────────────────────────────────────── */}
      <mesh position={[0, H + ridgeH + ROOF_T / 2, 0]} material={matFascia} castShadow>
        <boxGeometry args={[0.18, ROOF_T, roofL]} />
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
        gl={{ toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
      >
        <color attach="background" args={["#D8DDE3"]} />
        <ambientLight intensity={0.55} />
        <directionalLight
          position={[14, 22, 12]}
          intensity={1.6}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-28}
          shadow-camera-right={28}
          shadow-camera-top={28}
          shadow-camera-bottom={-28}
          shadow-camera-near={0.5}
          shadow-camera-far={90}
        />
        <directionalLight position={[-6, 5, -8]} intensity={0.18} />

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
          args={[60, 60]}
          cellSize={1}
          cellThickness={0.4}
          cellColor="#b8b8b8"
          sectionSize={5}
          sectionThickness={0.8}
          sectionColor="#999999"
          fadeDistance={45}
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

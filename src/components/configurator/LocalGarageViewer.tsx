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
const WALL_H      = 3.0;
const WALL_T      = 0.10;
const ROOF_T      = 0.10;
const OVERHANG    = 0.45;
const ROOF_ANGLE  = 22 * (Math.PI / 180);
const BOARD_W     = 0.145; // 145 mm boards (stående kledning)

// ── Colors from the logo ─────────────────────────────────────────────────────
const WALL_COLOR  = "#f2ede6"; // painted board face (cream-white)
const ROOF_COLOR  = "#e2520a"; // brand orange
const DOOR_COLOR  = "#1c1917"; // near-black door panels
const FLOOR_COLOR = "#e5e2de"; // light concrete

// ── Canvas texture for stående kledning ──────────────────────────────────────
// Returns one base texture; caller clones and sets repeat.
function buildCladdingTexture(): THREE.CanvasTexture {
  const W = 128, H = 16;
  const GAP = 16; // pixels for the shadow gap (12.5% of width)

  const canvas = document.createElement("canvas");
  canvas.width  = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // Board face
  ctx.fillStyle = WALL_COLOR;
  ctx.fillRect(0, 0, W - GAP, H);

  // Subtle horizontal grain lines (very faint)
  for (let y = 3; y < H; y += 5) {
    ctx.fillStyle = "rgba(0,0,0,0.025)";
    ctx.fillRect(0, y, W - GAP - 4, 1);
  }

  // Left highlight edge (chamfer / slight bevel)
  ctx.fillStyle = "rgba(255,255,255,0.22)";
  ctx.fillRect(0, 0, 3, H);

  // Right shadow gap (dark groove between boards)
  const grad = ctx.createLinearGradient(W - GAP, 0, W, 0);
  grad.addColorStop(0.0, "rgba(0,0,0,0.0)");
  grad.addColorStop(0.3, "rgba(0,0,0,0.18)");
  grad.addColorStop(0.7, "rgba(0,0,0,0.55)");
  grad.addColorStop(1.0, "rgba(0,0,0,0.75)");
  ctx.fillStyle = grad;
  ctx.fillRect(W - GAP, 0, GAP, H);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.anisotropy = 4;
  return tex;
}

// ── Per-wall material helper ──────────────────────────────────────────────────
function claddingMaterial(base: THREE.CanvasTexture, wallWidthM: number) {
  const t = base.clone();
  t.repeat.set(Math.max(1, wallWidthM / BOARD_W), 1);
  t.needsUpdate = true;
  return new THREE.MeshStandardMaterial({ map: t, roughness: 0.88, metalness: 0 });
}

// ── Roof canvas texture (corrugated metal look) ───────────────────────────────
function buildRoofTexture(): THREE.CanvasTexture {
  const W = 64, H = 64;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = ROOF_COLOR;
  ctx.fillRect(0, 0, W, H);
  // Subtle horizontal corrugation lines
  for (let y = 0; y < H; y += 8) {
    ctx.fillStyle = "rgba(0,0,0,0.12)";
    ctx.fillRect(0, y, W, 1);
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.fillRect(0, y + 1, W, 1);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// ── Triangular gable end ─────────────────────────────────────────────────────
function GableEnd({ z, halfW, ridgeH, mat }: {
  z: number; halfW: number; ridgeH: number; mat: THREE.Material;
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
    <mesh position={[0, WALL_H, z]} material={mat} castShadow receiveShadow>
      <shapeGeometry args={[shape]} />
    </mesh>
  );
}

// ── Main garage geometry ──────────────────────────────────────────────────────
function GarageGeometry({
  lengthM, widthM, doorWidthM, doorHeightM,
}: {
  lengthM: number; widthM: number; doorWidthM: number; doorHeightM: number;
}) {
  const H = WALL_H;
  const T = WALL_T;
  const halfW = widthM  / 2;
  const halfL = lengthM / 2;
  const sideW = (widthM - doorWidthM) / 2;
  const aboveDoor = H - doorHeightM;

  // Pitched roof
  const ridgeH   = halfW * Math.tan(ROOF_ANGLE);
  const slopeLen = halfW / Math.cos(ROOF_ANGLE);
  const roofL    = lengthM + OVERHANG * 2;
  const slopeCY  = H + ridgeH / 2;

  // Door panels
  const PANELS = 5;
  const panelH = doorHeightM / PANELS;

  // ── Textures (created once per dimension change) ──────────────────────────
  const baseTex  = useMemo(buildCladdingTexture, []);
  const roofTex  = useMemo(buildRoofTexture, []);

  // Wall materials keyed by width
  const matBack      = useMemo(() => claddingMaterial(baseTex, widthM),  [baseTex, widthM]);
  const matSide      = useMemo(() => claddingMaterial(baseTex, lengthM), [baseTex, lengthM]);
  const matPier      = useMemo(() => claddingMaterial(baseTex, sideW),   [baseTex, sideW]);
  const matLintel    = useMemo(() => claddingMaterial(baseTex, doorWidthM), [baseTex, doorWidthM]);
  const matGable     = useMemo(() => claddingMaterial(baseTex, widthM),  [baseTex, widthM]);

  const matRoof = useMemo(() => {
    const t = roofTex.clone();
    t.repeat.set(roofL / 0.4, slopeLen / 0.15);
    t.needsUpdate = true;
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.7, metalness: 0.15 });
  }, [roofTex, roofL, slopeLen]);

  const matDoor = useMemo(
    () => new THREE.MeshStandardMaterial({ color: DOOR_COLOR, roughness: 0.6, metalness: 0.1 }),
    []
  );
  const matFloor = useMemo(
    () => new THREE.MeshStandardMaterial({ color: FLOOR_COLOR, roughness: 0.9 }),
    []
  );
  const matRidgeCap = useMemo(
    () => new THREE.MeshStandardMaterial({ color: ROOF_COLOR, roughness: 0.7, metalness: 0.15 }),
    []
  );

  return (
    <group>
      {/* ── Floor ──────────────────────────────────────────────────────── */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]} material={matFloor} receiveShadow>
        <planeGeometry args={[widthM - T * 2, lengthM - T * 2]} />
      </mesh>

      {/* ── Back wall ──────────────────────────────────────────────────── */}
      <mesh position={[0, H / 2, -halfL + T / 2]} material={matBack} castShadow receiveShadow>
        <boxGeometry args={[widthM, H, T]} />
      </mesh>

      {/* ── Left wall ──────────────────────────────────────────────────── */}
      <mesh position={[-halfW + T / 2, H / 2, 0]} material={matSide} castShadow receiveShadow>
        <boxGeometry args={[T, H, lengthM]} />
      </mesh>

      {/* ── Right wall ─────────────────────────────────────────────────── */}
      <mesh position={[halfW - T / 2, H / 2, 0]} material={matSide} castShadow receiveShadow>
        <boxGeometry args={[T, H, lengthM]} />
      </mesh>

      {/* ── Front – left pier ──────────────────────────────────────────── */}
      {sideW > 0.01 && (
        <mesh position={[-halfW + sideW / 2, H / 2, halfL - T / 2]} material={matPier} castShadow receiveShadow>
          <boxGeometry args={[sideW, H, T]} />
        </mesh>
      )}

      {/* ── Front – right pier ─────────────────────────────────────────── */}
      {sideW > 0.01 && (
        <mesh position={[halfW - sideW / 2, H / 2, halfL - T / 2]} material={matPier} castShadow receiveShadow>
          <boxGeometry args={[sideW, H, T]} />
        </mesh>
      )}

      {/* ── Front – lintel above door ───────────────────────────────────── */}
      {aboveDoor > 0.02 && (
        <mesh position={[0, doorHeightM + aboveDoor / 2, halfL - T / 2]} material={matLintel} castShadow receiveShadow>
          <boxGeometry args={[doorWidthM, aboveDoor, T]} />
        </mesh>
      )}

      {/* ── Garage door – horizontal panel sections ─────────────────────── */}
      {Array.from({ length: PANELS }).map((_, i) => (
        <mesh key={i} position={[0, i * panelH + panelH / 2, halfL - T / 2 + 0.006]} material={matDoor}>
          <boxGeometry args={[doorWidthM - 0.06, panelH - 0.05, 0.03]} />
        </mesh>
      ))}

      {/* ── Left roof slope ─────────────────────────────────────────────── */}
      <mesh position={[-halfW / 2, slopeCY, 0]} rotation={[0, 0, ROOF_ANGLE]} material={matRoof} castShadow receiveShadow>
        <boxGeometry args={[slopeLen, ROOF_T, roofL]} />
      </mesh>

      {/* ── Right roof slope ────────────────────────────────────────────── */}
      <mesh position={[halfW / 2, slopeCY, 0]} rotation={[0, 0, -ROOF_ANGLE]} material={matRoof} castShadow receiveShadow>
        <boxGeometry args={[slopeLen, ROOF_T, roofL]} />
      </mesh>

      {/* ── Ridge cap ───────────────────────────────────────────────────── */}
      <mesh position={[0, H + ridgeH + ROOF_T / 2, 0]} material={matRidgeCap} castShadow>
        <boxGeometry args={[0.14, ROOF_T, roofL]} />
      </mesh>

      {/* ── Gable ends ──────────────────────────────────────────────────── */}
      <GableEnd z={-halfL + T / 2} halfW={halfW} ridgeH={ridgeH} mat={matGable} />
      <GableEnd z={ halfL - T / 2} halfW={halfW} ridgeH={ridgeH} mat={matGable} />
    </group>
  );
}

// ── Viewer ───────────────────────────────────────────────────────────────────
export default function LocalGarageViewer({ lengthMm, widthMm, doorWidthMm, doorHeightMm }: LocalGarageViewerProps) {
  return (
    <div className="relative h-full w-full">
      <Canvas
        shadows
        camera={{ position: [14, 8, 14], fov: 40 }}
        gl={{ toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
      >
        <color attach="background" args={["#f5f5f4"]} />
        <ambientLight intensity={0.5} />
        <directionalLight
          position={[12, 18, 10]}
          intensity={1.5}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-22}
          shadow-camera-right={22}
          shadow-camera-top={22}
          shadow-camera-bottom={-22}
          shadow-camera-near={0.5}
          shadow-camera-far={80}
        />
        <directionalLight position={[-8, 6, -6]} intensity={0.3} />

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

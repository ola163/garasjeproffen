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
const BOARD_W    = 0.145;  // 145 mm stående kledning

// ── Colors ───────────────────────────────────────────────────────────────────
const BOARD_FACE_COLOR = "#7B4A2D"; // brun kledning
const DOOR_COLOR       = "#FFFFFF"; // hvit port
const FLOOR_COLOR      = "#e5e2de";
const TILE_COLOR       = "#e2520a"; // brand orange tak

// ── Stående kledning texture ─────────────────────────────────────────────────
// One board unit in canvas (wraps horizontally). The face color is brown,
// shadow groove on the right edge.
function buildCladdingTexture(): THREE.CanvasTexture {
  const W = 128, H = 16, GAP = 14;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // Board face – brown
  ctx.fillStyle = BOARD_FACE_COLOR;
  ctx.fillRect(0, 0, W - GAP, H);

  // Subtle horizontal grain lines
  for (let y = 3; y < H; y += 5) {
    ctx.fillStyle = "rgba(0,0,0,0.04)";
    ctx.fillRect(0, y, W - GAP - 4, 1);
  }

  // Left chamfer highlight
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.fillRect(0, 0, 3, H);

  // Right shadow groove between boards
  const grad = ctx.createLinearGradient(W - GAP, 0, W, 0);
  grad.addColorStop(0.0, "rgba(0,0,0,0.0)");
  grad.addColorStop(0.3, "rgba(0,0,0,0.22)");
  grad.addColorStop(0.7, "rgba(0,0,0,0.60)");
  grad.addColorStop(1.0, "rgba(0,0,0,0.85)");
  ctx.fillStyle = grad;
  ctx.fillRect(W - GAP, 0, GAP, H);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.anisotropy = 4;
  return tex;
}

// ── Roof tile texture (panner) ───────────────────────────────────────────────
// Each tile unit in canvas ≈ 32 cm wide × 30 cm tall on slope.
function buildTileTexture(): THREE.CanvasTexture {
  const W = 128, H = 128;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // Base tile colour
  ctx.fillStyle = TILE_COLOR;
  ctx.fillRect(0, 0, W, H);

  // Slight colour variation across tile surface
  const bodyGrad = ctx.createLinearGradient(0, 0, W, H);
  bodyGrad.addColorStop(0, "rgba(255,255,255,0.06)");
  bodyGrad.addColorStop(1, "rgba(0,0,0,0.12)");
  ctx.fillStyle = bodyGrad;
  ctx.fillRect(0, 0, W, H);

  // Shadow at top (hidden under overlapping tile above)
  const topShad = ctx.createLinearGradient(0, 0, 0, H * 0.22);
  topShad.addColorStop(0, "rgba(0,0,0,0.55)");
  topShad.addColorStop(1, "rgba(0,0,0,0.0)");
  ctx.fillStyle = topShad;
  ctx.fillRect(0, 0, W, H * 0.22);

  // Highlight near exposed bottom edge
  const btmLight = ctx.createLinearGradient(0, H * 0.82, 0, H);
  btmLight.addColorStop(0, "rgba(255,255,255,0.0)");
  btmLight.addColorStop(1, "rgba(255,255,255,0.10)");
  ctx.fillStyle = btmLight;
  ctx.fillRect(0, H * 0.82, W, H);

  // Vertical joint line (left)
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(0, 0, 3, H);

  // Tiny right highlight on the adjacent tile edge
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.fillRect(W - 3, 0, 3, H);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.anisotropy = 4;
  return tex;
}

// ── Per-wall cladding material ────────────────────────────────────────────────
function makeWallMat(base: THREE.CanvasTexture, wallWidthM: number, wallHeightM: number) {
  const t = base.clone();
  t.repeat.set(Math.max(1, wallWidthM / BOARD_W), wallHeightM);
  t.needsUpdate = true;
  return new THREE.MeshStandardMaterial({ map: t, roughness: 0.9, metalness: 0 });
}

// ── Gable end (triangle above wall top) with cladding ────────────────────────
// ShapeGeometry auto-generates UVs from the shape's bounding box ([0,1]×[0,1]),
// so applying a material with repeat.x = widthM/BOARD_W tiles correctly.
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
  const aboveDoor = H - doorHeightM;

  // Pitched roof
  const ridgeH   = halfW * Math.tan(ROOF_ANGLE);
  const slopeLen = halfW / Math.cos(ROOF_ANGLE);
  const roofL    = lengthM + OVERHANG * 2;
  const slopeCY  = H + ridgeH / 2;

  // Total wall height including gable
  const totalWallH = H + ridgeH;

  // Door panels
  const PANELS = 5;
  const panelH = doorHeightM / PANELS;

  // ── Textures ──────────────────────────────────────────────────────────────
  const baseTex = useMemo(buildCladdingTexture, []);
  const tileTex = useMemo(buildTileTexture, []);

  // Wall materials — height goes all the way to the roof apex for gable sections
  const matBack   = useMemo(() => makeWallMat(baseTex, widthM,     H),          [baseTex, widthM]);
  const matSide   = useMemo(() => makeWallMat(baseTex, lengthM,    H),          [baseTex, lengthM]);
  const matPier   = useMemo(() => makeWallMat(baseTex, sideW,      H),          [baseTex, sideW]);
  const matLintel = useMemo(() => makeWallMat(baseTex, doorWidthM, aboveDoor),  [baseTex, doorWidthM, aboveDoor]);

  // Gable material – same texture with same X repeat so boards line up
  const matGable  = useMemo(() => makeWallMat(baseTex, widthM,     ridgeH),     [baseTex, widthM, ridgeH]);

  // Roof tile material
  const matTile = useMemo(() => {
    const t = tileTex.clone();
    // Along slope (local X = slopeLen): one tile ≈ 0.30 m
    // Along ridge (local Z = roofL):   one tile ≈ 0.32 m
    t.repeat.set(slopeLen / 0.30, roofL / 0.32);
    t.needsUpdate = true;
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.75, metalness: 0.05 });
  }, [tileTex, slopeLen, roofL]);

  const matDoor = useMemo(() =>
    new THREE.MeshStandardMaterial({ color: DOOR_COLOR, roughness: 0.35, metalness: 0.05 }),
    []
  );
  const matFloor = useMemo(() =>
    new THREE.MeshStandardMaterial({ color: FLOOR_COLOR, roughness: 0.9 }),
    []
  );
  const matRidge = useMemo(() =>
    new THREE.MeshStandardMaterial({ color: TILE_COLOR, roughness: 0.7 }),
    []
  );

  return (
    <group>
      {/* ── Floor ──────────────────────────────────────────────────── */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]}
            material={matFloor} receiveShadow>
        <planeGeometry args={[widthM - T * 2, lengthM - T * 2]} />
      </mesh>

      {/* ── Back wall (full height rectangle) ──────────────────────── */}
      <mesh position={[0, H / 2, -halfL + T / 2]}
            material={matBack} castShadow receiveShadow>
        <boxGeometry args={[widthM, H, T]} />
      </mesh>

      {/* ── Back gable – triangle above wall top ───────────────────── */}
      <GableEnd z={-halfL + T / 2} halfW={halfW} ridgeH={ridgeH} mat={matGable} />

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

      {/* ── Front gable – continues cladding above the door opening ─── */}
      <GableEnd z={halfL - T / 2} halfW={halfW} ridgeH={ridgeH} mat={matGable} />

      {/* ── Garage door – horizontal panel sections (hvit) ─────────── */}
      {Array.from({ length: PANELS }).map((_, i) => (
        <mesh key={i}
              position={[0, i * panelH + panelH / 2, halfL - T / 2 + 0.006]}
              material={matDoor}>
          <boxGeometry args={[doorWidthM - 0.06, panelH - 0.05, 0.03]} />
        </mesh>
      ))}

      {/* ── Left roof slope (panner) ─────────────────────────────────── */}
      <mesh position={[-halfW / 2, slopeCY, 0]}
            rotation={[0, 0, ROOF_ANGLE]}
            material={matTile} castShadow receiveShadow>
        <boxGeometry args={[slopeLen, ROOF_T, roofL]} />
      </mesh>

      {/* ── Right roof slope (panner) ────────────────────────────────── */}
      <mesh position={[halfW / 2, slopeCY, 0]}
            rotation={[0, 0, -ROOF_ANGLE]}
            material={matTile} castShadow receiveShadow>
        <boxGeometry args={[slopeLen, ROOF_T, roofL]} />
      </mesh>

      {/* ── Ridge cap ───────────────────────────────────────────────── */}
      <mesh position={[0, H + ridgeH + ROOF_T / 2, 0]}
            material={matRidge} castShadow>
        <boxGeometry args={[0.15, ROOF_T, roofL]} />
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
        {/* Fill light from the opposite side */}
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

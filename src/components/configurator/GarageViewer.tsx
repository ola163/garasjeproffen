"use client";

import { useRef, useEffect, useMemo, Suspense, Component, type ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import { OrbitControls, Environment, Grid, useGLTF, Line, Text } from "@react-three/drei";
import { Box3, Vector3, Mesh, MeshStandardMaterial } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { AddedElement, ElementCategory } from "./DoorWindowAdder";

useGLTF.preload("/Vindu_100x50glb.glb");

interface GarageViewerProps {
  lengthMm: number;
  widthMm: number;
  doorWidthMm: number;
  doorHeightMm: number;
  roofType?: "saltak" | "flattak";
  addedElements?: AddedElement[];
}

// ── Window rendering constants (mirror LocalGarageViewer) ─────────────────────
const WALL_H       = 3.0;
const WALL_T       = 0.12;
const FRAME_BORDER = 0.055;
const FRAME_DEPTH  = 0.10;
const GLASS_INSET  = 0.04;
const SILL_H       = 0.035;
const SILL_EXTRA   = 0.05;

const WINDOW_COLOR  = "#9ECFEA";
const FRAME_COLOR   = "#FFFFFF";
const SILL_COLOR    = "#E0E0DE";
const DOOR_EL_COLOR = "#C4A882";

function getElDims(cat: ElementCategory) {
  const w  = cat === "door" ? 0.9 : 1.0;
  const h  = cat === "door" ? 2.1 : cat === "window1" ? 0.5 : cat === "window2" ? 0.6 : 1.0;
  const cy = cat === "door" ? h / 2 : WALL_H * 0.55;
  return { w, h, cy };
}

function WindowGLBInner({ position, rotY }: { position: [number, number, number]; rotY: number }) {
  const { scene } = useGLTF("/Vindu_100x50glb.glb");
  const group = useMemo(() => {
    const clone = scene.clone(true);
    const box = new Box3().setFromObject(clone);
    const size = new Vector3(); box.getSize(size);
    if (size.x > 0.001 && size.y > 0.001) {
      clone.scale.set(1.0 / size.x, 0.5 / size.y, size.z > 0.001 ? (WALL_T * 3) / size.z : 1);
    }
    const box2 = new Box3().setFromObject(clone);
    const center = new Vector3(); box2.getCenter(center);
    clone.position.sub(center);
    clone.traverse(c => { if ((c as Mesh).isMesh) { c.castShadow = true; c.receiveShadow = true; } });
    const g = new THREE.Group(); g.add(clone); return g;
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

function GarageWindowElements({ elements, lengthM, widthM }: {
  elements: AddedElement[]; lengthM: number; widthM: number;
}) {
  const halfL = lengthM / 2;
  const halfW = widthM  / 2;
  const matWindow = useMemo(() => new THREE.MeshStandardMaterial({ color: WINDOW_COLOR, roughness: 0.05, metalness: 0.3 }), []);
  const matDoorEl = useMemo(() => new THREE.MeshStandardMaterial({ color: DOOR_EL_COLOR, roughness: 0.6 }), []);
  const matFrame  = useMemo(() => new THREE.MeshStandardMaterial({ color: FRAME_COLOR,   roughness: 0.5 }), []);
  const matSill   = useMemo(() => new THREE.MeshStandardMaterial({ color: SILL_COLOR,    roughness: 0.55 }), []);

  const meshes: React.ReactNode[] = [];
  elements.forEach((el, idx) => {
    const { w, h, cy } = getElDims(el.category);
    const isGLBWindow = el.category === "window1";
    const isWindow    = el.category !== "door";
    const fracs = el.placement === "both" ? [-0.25, 0.25] : el.placement === "left" ? [0.25] : [-0.25];

    fracs.forEach((frac, pi) => {
      const key = `${idx}-${pi}`;
      if (el.side === "front" || el.side === "back") {
        const dir    = el.side === "front" ? 1 : -1;
        const wFace  = dir * halfL;
        const wCz    = dir * (halfL - WALL_T / 2);
        const x      = widthM * frac;
        const rotY   = el.side === "back" ? Math.PI : 0;
        if (isGLBWindow) {
          meshes.push(<WindowGLB key={key} position={[x, cy, wCz]} rotY={rotY} />);
        } else if (isWindow) {
          meshes.push(
            <mesh key={`${key}-fr`} position={[x, cy, wFace + dir * FRAME_DEPTH / 2]} material={matFrame} castShadow receiveShadow>
              <boxGeometry args={[w + FRAME_BORDER * 2, h + FRAME_BORDER * 2, FRAME_DEPTH]} />
            </mesh>,
            <mesh key={`${key}-gl`} position={[x, cy, wFace + dir * (FRAME_DEPTH - GLASS_INSET)]} material={matWindow}>
              <boxGeometry args={[w, h, 0.015]} />
            </mesh>,
            <mesh key={`${key}-si`} position={[x, cy - h / 2 - SILL_H / 2, wFace + dir * (FRAME_DEPTH / 2 + SILL_EXTRA / 2)]} material={matSill} castShadow>
              <boxGeometry args={[w + FRAME_BORDER * 2 + 0.06, SILL_H, FRAME_DEPTH + SILL_EXTRA]} />
            </mesh>,
          );
        } else {
          meshes.push(<mesh key={key} position={[x, cy, wFace + dir * 0.05]} material={matDoorEl} castShadow><boxGeometry args={[w, h, 0.05]} /></mesh>);
        }
      } else {
        const dir    = el.side === "right" ? 1 : -1;
        const wFace  = dir * halfW;
        const wCx    = dir * (halfW - WALL_T / 2);
        const z      = lengthM * frac;
        const rotY   = el.side === "right" ? -Math.PI / 2 : Math.PI / 2;
        if (isGLBWindow) {
          meshes.push(<WindowGLB key={key} position={[wCx, cy, z]} rotY={rotY} />);
        } else if (isWindow) {
          meshes.push(
            <mesh key={`${key}-fr`} position={[wFace + dir * FRAME_DEPTH / 2, cy, z]} rotation={[0, Math.PI / 2, 0]} material={matFrame} castShadow receiveShadow>
              <boxGeometry args={[w + FRAME_BORDER * 2, h + FRAME_BORDER * 2, FRAME_DEPTH]} />
            </mesh>,
            <mesh key={`${key}-gl`} position={[wFace + dir * (FRAME_DEPTH - GLASS_INSET), cy, z]} rotation={[0, Math.PI / 2, 0]} material={matWindow}>
              <boxGeometry args={[w, h, 0.015]} />
            </mesh>,
            <mesh key={`${key}-si`} position={[wFace + dir * (FRAME_DEPTH / 2 + SILL_EXTRA / 2), cy - h / 2 - SILL_H / 2, z]} rotation={[0, Math.PI / 2, 0]} material={matSill} castShadow>
              <boxGeometry args={[w + FRAME_BORDER * 2 + 0.06, SILL_H, FRAME_DEPTH + SILL_EXTRA]} />
            </mesh>,
          );
        } else {
          meshes.push(<mesh key={key} position={[wFace + dir * 0.05, cy, z]} rotation={[0, Math.PI / 2, 0]} material={matDoorEl} castShadow><boxGeometry args={[w, h, 0.05]} /></mesh>);
        }
      }
    });
  });
  return <>{meshes}</>;
}

function DimensionLine({
  start, end, label, color = "#e2520a", offset = [0, 0, 0],
}: {
  start: [number, number, number];
  end: [number, number, number];
  label: string;
  color?: string;
  offset?: [number, number, number];
}) {
  const s = new Vector3(...start).add(new Vector3(...offset));
  const e = new Vector3(...end).add(new Vector3(...offset));
  const mid = s.clone().add(e).multiplyScalar(0.5);
  const points: [number, number, number][] = [
    [s.x, s.y, s.z],
    [e.x, e.y, e.z],
  ];
  return (
    <group>
      <Line points={points} color={color} lineWidth={1.5} />
      <Text
        position={[mid.x, mid.y + 0.15, mid.z]}
        fontSize={0.22}
        color={color}
        anchorX="center"
        anchorY="bottom"
        outlineWidth={0.02}
        outlineColor="#fff"
      >
        {label}
      </Text>
    </group>
  );
}

function GarageModel({ lengthMm, widthMm, roofType }: { lengthMm: number; widthMm: number; roofType?: string }) {
  const modelUrl = roofType === "flattak" ? "/garasje_flatt_tak.glb" : "/garasje_saltak.glb";
  const { scene: rawScene } = useGLTF(modelUrl);
  // Clone so mutations don't affect the cached scene shared across remounts
  const scene = useMemo(() => rawScene.clone(true), [rawScene]);
  const boxRef = useRef<Box3 | null>(null);

  useEffect(() => {
    // GLB/GLTF is Y-up — no axis rotation needed. Try flipping to face front.
    scene.rotation.set(0, 0, 0);
    scene.scale.set(1, 1, 1);
    scene.updateMatrixWorld(true);

    const box = new Box3().setFromObject(scene);
    const size = box.getSize(new Vector3());

    const targetWidth  = widthMm  / 1000;
    const targetLength = lengthMm / 1000;

    const scaleX = size.x > 0 ? targetWidth  / size.x : 1;
    const scaleZ = size.z > 0 ? targetLength / size.z : 1;

    scene.scale.set(scaleX, 1, scaleZ);
    scene.updateMatrixWorld(true);

    const finalBox = new Box3().setFromObject(scene);
    const center   = finalBox.getCenter(new Vector3());
    scene.position.set(-center.x, -finalBox.min.y, -center.z);

    boxRef.current = new Box3().setFromObject(scene);

    scene.traverse((child) => {
      if (child instanceof Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        mats.forEach((mat) => {
          if (mat instanceof MeshStandardMaterial) {
            mat.envMapIntensity = 0.4;
            mat.needsUpdate = true;
          }
        });
      }
    });
  }, [scene, lengthMm, widthMm]);

  const W = widthMm  / 1000;
  const L = lengthMm / 1000;
  const halfW = W / 2;
  const halfL = L / 2;
  const y = -0.05;

  return (
    <>
      <primitive object={scene} dispose={null} />

      {/* Width dimension (X axis) */}
      <DimensionLine
        start={[-halfW, y, halfL + 0.5]}
        end={[halfW, y, halfL + 0.5]}
        label={`${(widthMm / 1000).toFixed(1)} m`}
        color="#e2520a"
        offset={[0, 0, 0]}
      />

      {/* Length dimension (Z axis) */}
      <DimensionLine
        start={[halfW + 0.5, y, -halfL]}
        end={[halfW + 0.5, y, halfL]}
        label={`${(lengthMm / 1000).toFixed(1)} m`}
        color="#2563eb"
        offset={[0, 0, 0]}
      />

      {/* Axis arrows */}
      <axesHelper args={[1.5]} />
    </>
  );
}

class GltfErrorBoundary extends Component<
  { children: ReactNode; onError: (msg: string) => void },
  { failed: boolean }
> {
  state = { failed: false };
  componentDidCatch(err: Error) {
    this.props.onError(err.message);
    this.setState({ failed: true });
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export default function GarageViewer({ lengthMm, widthMm, roofType, addedElements = [] }: GarageViewerProps) {
  const orbitRef = useRef<OrbitControlsImpl>(null);

  return (
    <div className="relative h-full w-full">
      <div className="absolute bottom-3 left-1/2 z-10 -translate-x-1/2 w-[90%] max-w-sm rounded-lg bg-yellow-400/90 px-3 py-2 text-center text-xs font-medium text-yellow-900 shadow backdrop-blur-sm">
        ⚠ Dette er en tidlig testvisning av 3D-modellen. Proporsjoner og detaljer kan avvike fra det ferdige produktet — vi jobber kontinuerlig med forbedringer.
      </div>
      <Canvas
        shadows
        camera={{ position: [12, 7, 12], fov: 42 }}
        gl={{ toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0 }}
      >
        <color attach="background" args={["#f5f5f4"]} />
        <ambientLight intensity={0.6} />
        <directionalLight position={[10, 15, 10]} intensity={1.2} castShadow shadow-mapSize={[2048, 2048]} />

        <GltfErrorBoundary onError={(msg) => console.error("3D-feil:", msg)}>
          <Suspense fallback={null}>
            <GarageModel key={roofType ?? "saltak"} lengthMm={lengthMm} widthMm={widthMm} roofType={roofType} />
          </Suspense>
        </GltfErrorBoundary>
        <GarageWindowElements elements={addedElements} lengthM={lengthMm / 1000} widthM={widthMm / 1000} />

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
          ref={orbitRef}
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

"use client";

import { useRef, useEffect, useMemo, useState, useCallback, Suspense, Component, type ReactNode } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { OrbitControls, Environment, Grid, useGLTF, Line, Text, GizmoHelper, GizmoViewport } from "@react-three/drei";
import { Box3, Vector3, Mesh, MeshStandardMaterial } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { AddedElement, ElementCategory } from "./DoorWindowAdder";
import { computePortOffset } from "./DoorWindowAdder";

useGLTF.preload("/Vindu_100x50glb.glb");
useGLTF.preload("/Carport_GLB.glb");
useGLTF.preload("/Garasje_Flatt_tak.glb");
useGLTF.preload("/Garasje_saltak1.glb");
useGLTF.preload("/Garasjeport_2500x2125.glb");

interface GarageViewerProps {
  lengthMm: number;
  widthMm: number;
  doorWidthMm: number;
  doorHeightMm: number;
  doorColor?: "hvit" | "sort";
  roofType?: "saltak" | "flattak";
  addedElements?: AddedElement[];
  buildingType?: string;
  rotationDeg?: number;
  demoDoorOpen?: boolean;
  autoRotate?: boolean;
  [key: string]: unknown;
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
const REVEAL_COLOR  = "#cfc5bc"; // inner wall reveal / jamb colour

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
      clone.scale.set(1.0 / size.x, 0.5 / size.y, size.z > 0.001 ? WALL_T / size.z : 1);
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

const DOOR_SIDE_GAP = 0.15; // gap between garage port and adjacent pedestrian door

function GarageWindowElements({ elements, lengthM, widthM, halfLOverride, halfWOverride, doorWidthM, hasFlatRoof, portOffsetX = 0 }: {
  elements: AddedElement[]; lengthM: number; widthM: number;
  halfLOverride?: number; halfWOverride?: number;
  doorWidthM?: number; hasFlatRoof?: boolean; portOffsetX?: number;
}) {
  const halfL = halfLOverride ?? lengthM / 2;
  const halfW = halfWOverride ?? widthM  / 2;
  const matWindow   = useMemo(() => new THREE.MeshStandardMaterial({ color: WINDOW_COLOR, roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.55 }), []);
  const matDoorEl   = useMemo(() => new THREE.MeshStandardMaterial({ color: DOOR_EL_COLOR, roughness: 0.6 }), []);
  const matFrame    = useMemo(() => new THREE.MeshStandardMaterial({ color: FRAME_COLOR,   roughness: 0.5 }), []);
  const matSill     = useMemo(() => new THREE.MeshStandardMaterial({ color: SILL_COLOR,    roughness: 0.55 }), []);
  const matReveal   = useMemo(() => new THREE.MeshStandardMaterial({ color: REVEAL_COLOR,  roughness: 0.7 }), []);
  const matInterior = useMemo(() => new THREE.MeshBasicMaterial({ color: "#0d0808" }), []);
  const matCut      = useMemo(() => {
    const m = new THREE.MeshBasicMaterial();
    m.colorWrite  = false;
    m.depthWrite  = false;
    m.depthTest   = false;
    m.side        = THREE.DoubleSide;
    m.stencilWrite = true;
    m.stencilFunc  = THREE.AlwaysStencilFunc;
    m.stencilRef   = 1;
    m.stencilZPass = THREE.ReplaceStencilOp;
    return m;
  }, []);

  const meshes: React.ReactNode[] = [];
  elements.forEach((el, idx) => {
    const { w, h, cy } = getElDims(el.category);
    const isGLBWindow = el.category === "window1";
    const isWindow    = el.category !== "door";
    const fracs = el.placement === "both" ? [-0.25, 0.25] : el.placement === "left" ? [0.25] : [-0.25];
    const FB = FRAME_BORDER;

    fracs.forEach((frac, pi) => {
      const key = `${idx}-${pi}`;
      if (el.side === "front" || el.side === "back") {
        const dir   = el.side === "front" ? 1 : -1;
        const wFace = dir * halfL;
        const wCz   = dir * (halfL - WALL_T / 2);
        // Front wall: place next to garage port (offset by port shift); other walls use fixed frac
        const x = (el.side === "front" && hasFlatRoof && doorWidthM)
          ? portOffsetX + (frac > 0 ? 1 : -1) * (doorWidthM / 2 + DOOR_SIDE_GAP + w / 2)
          : widthM * frac;
        const rotY  = el.side === "back" ? Math.PI : 0;
        const revZ  = wFace - dir * FRAME_DEPTH / 2;

        const frontRevealsMeshes = [
          <mesh key={`${key}-rvL`} position={[x - (w / 2 + FB), cy, revZ]} material={matReveal}>
            <boxGeometry args={[0.012, h + FB * 2, FRAME_DEPTH]} />
          </mesh>,
          <mesh key={`${key}-rvR`} position={[x + (w / 2 + FB), cy, revZ]} material={matReveal}>
            <boxGeometry args={[0.012, h + FB * 2, FRAME_DEPTH]} />
          </mesh>,
          <mesh key={`${key}-rvT`} position={[x, cy + (h / 2 + FB), revZ]} material={matReveal}>
            <boxGeometry args={[w + FB * 2 + 0.024, 0.012, FRAME_DEPTH]} />
          </mesh>,
          <mesh key={`${key}-rvB`} position={[x, cy - (h / 2 + FB), revZ]} material={matReveal}>
            <boxGeometry args={[w + FB * 2 + 0.024, 0.012, FRAME_DEPTH]} />
          </mesh>,
        ];

        if (isGLBWindow) {
          meshes.push(
            <mesh key={`${key}-cut`} renderOrder={-2} position={[x, cy, wFace - dir * WALL_T / 2]} material={matCut}>
              <boxGeometry args={[w + FB * 2 + 0.02, h + FB * 2 + 0.02, WALL_T + 0.1]} />
            </mesh>,
            <mesh key={`${key}-int`} position={[x, cy, wFace - dir * (WALL_T + 0.4)]} material={matInterior}>
              <boxGeometry args={[w + FB * 2, h + FB * 2, 0.02]} />
            </mesh>,
            ...frontRevealsMeshes,
            <WindowGLB key={key} position={[x, cy, wCz]} rotY={rotY} />,
            <mesh key={`${key}-si`} position={[x, cy - h / 2 - SILL_H / 2, wFace + dir * (SILL_EXTRA / 2 - FRAME_DEPTH / 2)]} material={matSill} castShadow>
              <boxGeometry args={[w + FB * 2 + 0.06, SILL_H, FRAME_DEPTH + SILL_EXTRA]} />
            </mesh>,
          );
        } else if (isWindow) {
          meshes.push(
            <mesh key={`${key}-cut`} renderOrder={-2} position={[x, cy, wFace - dir * WALL_T / 2]} material={matCut}>
              <boxGeometry args={[w + FB * 2 + 0.02, h + FB * 2 + 0.02, WALL_T + 0.1]} />
            </mesh>,
            <mesh key={`${key}-int`} position={[x, cy, wFace - dir * (WALL_T + 0.4)]} material={matInterior}>
              <boxGeometry args={[w + FB * 2, h + FB * 2, 0.02]} />
            </mesh>,
            ...frontRevealsMeshes,
            <mesh key={`${key}-frL`} position={[x - (w / 2 + FB / 2), cy, revZ]} material={matFrame} castShadow>
              <boxGeometry args={[FB, h + 0.005, FRAME_DEPTH]} />
            </mesh>,
            <mesh key={`${key}-frR`} position={[x + (w / 2 + FB / 2), cy, revZ]} material={matFrame} castShadow>
              <boxGeometry args={[FB, h + 0.005, FRAME_DEPTH]} />
            </mesh>,
            <mesh key={`${key}-frT`} position={[x, cy + (h / 2 + FB / 2), revZ]} material={matFrame} castShadow>
              <boxGeometry args={[w + FB * 2, FB, FRAME_DEPTH]} />
            </mesh>,
            <mesh key={`${key}-frBt`} position={[x, cy - (h / 2 + FB / 2), revZ]} material={matFrame} castShadow>
              <boxGeometry args={[w + FB * 2, FB, FRAME_DEPTH]} />
            </mesh>,
            <mesh key={`${key}-gl`} position={[x, cy, wFace - dir * GLASS_INSET]} material={matWindow}>
              <boxGeometry args={[w, h, 0.012]} />
            </mesh>,
            <mesh key={`${key}-si`} position={[x, cy - h / 2 - SILL_H / 2, wFace + dir * (SILL_EXTRA / 2 - FRAME_DEPTH / 2)]} material={matSill} castShadow>
              <boxGeometry args={[w + FB * 2 + 0.06, SILL_H, FRAME_DEPTH + SILL_EXTRA]} />
            </mesh>,
          );
        } else {
          meshes.push(<mesh key={key} position={[x, cy, wFace - dir * 0.05]} material={matDoorEl} castShadow><boxGeometry args={[w, h, 0.05]} /></mesh>);
        }
      } else {
        const dir   = el.side === "right" ? 1 : -1;
        const wFace = dir * halfW;
        const wCx   = dir * (halfW - WALL_T / 2);
        const z     = lengthM * frac;
        const rotY  = el.side === "right" ? -Math.PI / 2 : Math.PI / 2;
        const revX  = wFace - dir * FRAME_DEPTH / 2;

        const sideRevealMeshes = [
          <mesh key={`${key}-rvL`} position={[revX, cy, z - (w / 2 + FB)]} material={matReveal}>
            <boxGeometry args={[FRAME_DEPTH, h + FB * 2, 0.012]} />
          </mesh>,
          <mesh key={`${key}-rvR`} position={[revX, cy, z + (w / 2 + FB)]} material={matReveal}>
            <boxGeometry args={[FRAME_DEPTH, h + FB * 2, 0.012]} />
          </mesh>,
          <mesh key={`${key}-rvT`} position={[revX, cy + (h / 2 + FB), z]} material={matReveal}>
            <boxGeometry args={[FRAME_DEPTH, 0.012, w + FB * 2]} />
          </mesh>,
          <mesh key={`${key}-rvB`} position={[revX, cy - (h / 2 + FB), z]} material={matReveal}>
            <boxGeometry args={[FRAME_DEPTH, 0.012, w + FB * 2]} />
          </mesh>,
        ];

        if (isGLBWindow) {
          meshes.push(
            <mesh key={`${key}-cut`} renderOrder={-2} position={[wFace - dir * WALL_T / 2, cy, z]} material={matCut}>
              <boxGeometry args={[WALL_T + 0.1, h + FB * 2 + 0.02, w + FB * 2 + 0.02]} />
            </mesh>,
            <mesh key={`${key}-int`} position={[wFace - dir * (WALL_T + 0.4), cy, z]} material={matInterior}>
              <boxGeometry args={[0.02, h + FB * 2, w + FB * 2]} />
            </mesh>,
            ...sideRevealMeshes,
            <WindowGLB key={key} position={[wCx, cy, z]} rotY={rotY} />,
            <mesh key={`${key}-si`} position={[wFace + dir * (SILL_EXTRA / 2 - FRAME_DEPTH / 2), cy - h / 2 - SILL_H / 2, z]} material={matSill} castShadow>
              <boxGeometry args={[FRAME_DEPTH + SILL_EXTRA, SILL_H, w + FB * 2 + 0.06]} />
            </mesh>,
          );
        } else if (isWindow) {
          meshes.push(
            <mesh key={`${key}-cut`} renderOrder={-2} position={[wFace - dir * WALL_T / 2, cy, z]} material={matCut}>
              <boxGeometry args={[WALL_T + 0.1, h + FB * 2 + 0.02, w + FB * 2 + 0.02]} />
            </mesh>,
            <mesh key={`${key}-int`} position={[wFace - dir * (WALL_T + 0.4), cy, z]} material={matInterior}>
              <boxGeometry args={[0.02, h + FB * 2, w + FB * 2]} />
            </mesh>,
            ...sideRevealMeshes,
            <mesh key={`${key}-frL`} position={[revX, cy, z - (w / 2 + FB / 2)]} material={matFrame} castShadow>
              <boxGeometry args={[FRAME_DEPTH, h + 0.005, FB]} />
            </mesh>,
            <mesh key={`${key}-frR`} position={[revX, cy, z + (w / 2 + FB / 2)]} material={matFrame} castShadow>
              <boxGeometry args={[FRAME_DEPTH, h + 0.005, FB]} />
            </mesh>,
            <mesh key={`${key}-frT`} position={[revX, cy + (h / 2 + FB / 2), z]} material={matFrame} castShadow>
              <boxGeometry args={[FRAME_DEPTH, FB, w + FB * 2]} />
            </mesh>,
            <mesh key={`${key}-frBt`} position={[revX, cy - (h / 2 + FB / 2), z]} material={matFrame} castShadow>
              <boxGeometry args={[FRAME_DEPTH, FB, w + FB * 2]} />
            </mesh>,
            <mesh key={`${key}-gl`} position={[wFace - dir * GLASS_INSET, cy, z]} material={matWindow}>
              <boxGeometry args={[0.012, h, w]} />
            </mesh>,
            <mesh key={`${key}-si`} position={[wFace + dir * (SILL_EXTRA / 2 - FRAME_DEPTH / 2), cy - h / 2 - SILL_H / 2, z]} material={matSill} castShadow>
              <boxGeometry args={[FRAME_DEPTH + SILL_EXTRA, SILL_H, w + FB * 2 + 0.06]} />
            </mesh>,
          );
        } else {
          meshes.push(<mesh key={key} position={[wFace - dir * 0.05, cy, z]} rotation={[0, Math.PI / 2, 0]} material={matDoorEl} castShadow><boxGeometry args={[w, h, 0.05]} /></mesh>);
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

function GarageModel({ lengthMm, widthMm, roofType, buildingType, rotationDeg, onWallFaces }: {
  lengthMm: number; widthMm: number; roofType?: string; buildingType?: string; rotationDeg?: number;
  onWallFaces?: (halfL: number, halfW: number) => void;
}) {
  const modelUrl = buildingType === "carport"
    ? "/Carport_GLB.glb"
    : roofType === "flattak" ? "/Garasje_Flatt_tak.glb" : "/Garasje_saltak1.glb";
  const { scene: rawScene } = useGLTF(modelUrl);

  const { scene, sizeX, sizeZ, cx, cz, minY } = useMemo(() => {
    const s = rawScene.clone(true);
    s.scale.set(1, 1, 1);
    s.position.set(0, 0, 0);
    s.rotation.set(0, 0, 0);
    s.updateMatrixWorld(true);
    const box0 = new Box3().setFromObject(s);
    const size0 = box0.getSize(new Vector3());
    const center0 = box0.getCenter(new Vector3());

    // For saltak: apply uniform grey to all roof meshes (both slopes)
    const isSaltak = modelUrl.includes("saltak");
    const roofThreshold = box0.min.y + size0.y * 0.55;
    const greyRoofMat = isSaltak ? new THREE.MeshStandardMaterial({ color: "#8a8f94", roughness: 0.8, metalness: 0.1, envMapIntensity: 0.4 }) : null;

    s.traverse(child => {
      if (child instanceof Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        mats.forEach(mat => {
          if (mat instanceof MeshStandardMaterial) {
            // Apply uniform grey to all roof meshes on saltak
            if (isSaltak && greyRoofMat) {
              const meshBox = new Box3().setFromObject(child);
              const meshCenterY = (meshBox.min.y + meshBox.max.y) / 2;
              if (meshCenterY >= roofThreshold) {
                (child as Mesh).material = greyRoofMat;
                return;
              }
            }
            mat.envMapIntensity = 0.4;
            mat.stencilWrite = false;
            mat.stencilFunc  = THREE.NotEqualStencilFunc;
            mat.stencilRef   = 1;
            mat.needsUpdate  = true;
          }
        });
      }
    });
    return { scene: s, sizeX: size0.x, sizeZ: size0.z, cx: center0.x, cz: center0.z, minY: box0.min.y };
  }, [rawScene, modelUrl]);

  const scaleX = sizeX > 0 ? widthMm  / 1000 / sizeX : 1;
  const scaleZ = sizeZ > 0 ? lengthMm / 1000 / sizeZ : 1;
  const rotRad = ((rotationDeg ?? 0) * Math.PI) / 180;

  // Vertex scan for wall face positions (needed for window placement + dimension lines)
  useEffect(() => {
    if (!onWallFaces) return;
    scene.scale.set(scaleX, 1, scaleZ);
    scene.position.set(-cx * scaleX, -minY, -cz * scaleZ);
    scene.rotation.y = rotRad;
    scene.updateMatrixWorld(true);
    const box = new Box3().setFromObject(scene);
    const yThresh = box.max.y * 0.65;
    let maxAbsX = 0, maxAbsZ = 0;
    const _v = new THREE.Vector3();
    scene.traverse(child => {
      const mesh = child as Mesh;
      if (!mesh.isMesh || !mesh.geometry?.attributes?.position) return;
      const pos = mesh.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        _v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
        if (_v.y < yThresh) {
          if (Math.abs(_v.x) > maxAbsX) maxAbsX = Math.abs(_v.x);
          if (Math.abs(_v.z) > maxAbsZ) maxAbsZ = Math.abs(_v.z);
        }
      }
    });
    if (maxAbsX > 0.1 && maxAbsZ > 0.1) onWallFaces(maxAbsZ, maxAbsX);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, scaleX, scaleZ, rotRad]);

  return (
    <>
      <primitive
        object={scene}
        dispose={null}
        scale={[scaleX, 1, scaleZ]}
        position={[-cx * scaleX, -minY, -cz * scaleZ]}
        rotation={[0, rotRad, 0]}
      />
      <axesHelper args={[1.5]} />
    </>
  );
}

function GaragePortFlat({ lengthMm, doorWidthMm, doorHeightMm, portOffsetX = 0, demoDoorOpen = false, doorColor = "hvit", roofType = "flattak" }: { lengthMm: number; doorWidthMm: number; doorHeightMm: number; portOffsetX?: number; demoDoorOpen?: boolean; doorColor?: "hvit" | "sort"; roofType?: string }) {
  const { scene: rawScene } = useGLTF("/Garasjeport_2500x2125.glb");
  const targetW = doorWidthMm / 1000;
  const targetH = doorHeightMm / 1000;

  const matCut    = useMemo(() => {
    const m = new THREE.MeshBasicMaterial();
    m.colorWrite  = false;
    m.depthWrite  = false;
    m.depthTest   = false;
    m.side        = THREE.DoubleSide;
    m.stencilWrite = true;
    m.stencilFunc  = THREE.AlwaysStencilFunc;
    m.stencilRef   = 1;
    m.stencilZPass = THREE.ReplaceStencilOp;
    return m;
  }, []);

  const group = useMemo(() => {
    const clone = rawScene.clone(true);
    const box = new Box3().setFromObject(clone);
    const size = new Vector3(); box.getSize(size);
    const center = new Vector3(); box.getCenter(center);
    const scaleX = size.x > 0.001 ? targetW / size.x : 1;
    const scaleY = size.y > 0.001 ? targetH / size.y : 1;
    const scaleZ = size.z > 0.001 ? 0.05 / size.z : 1;
    clone.scale.set(scaleX, scaleY, scaleZ);
    const paintColor = doorColor === "sort" ? "#1c1c1c" : "#f2f0ed";
    clone.traverse(c => {
      if ((c as Mesh).isMesh) {
        c.castShadow = true;
        c.receiveShadow = true;
        const orig = (c as Mesh).material as MeshStandardMaterial;
        const mat = orig.clone();
        mat.color.set(paintColor);
        mat.roughness = doorColor === "sort" ? 0.45 : 0.55;
        mat.metalness = doorColor === "sort" ? 0.15 : 0.05;
        (c as Mesh).material = mat;
      }
    });
    // Compute centering offsets — cannot set clone.position here because
    // <primitive position> would override it entirely, so pass offsets to primitive directly
    const ox = -center.x * scaleX;
    const oy = -box.min.y * scaleY;
    const oz = -center.z * scaleZ;
    return { clone, ox, oy, oz };
  }, [rawScene, targetW, targetH, doorColor]);

  const doorZ = roofType === "saltak" ? lengthMm / 2000 - WALL_T : lengthMm / 2000 - WALL_T / 2;
  const doorGroupRef = useRef<THREE.Group>(null);
  const doorYRef = useRef(0);
  const demoDoorOpenRef = useRef(demoDoorOpen);
  useEffect(() => { demoDoorOpenRef.current = demoDoorOpen; }, [demoDoorOpen]);

  useFrame(() => {
    if (!doorGroupRef.current) return;
    const target = demoDoorOpenRef.current ? targetH * 0.95 : 0;
    doorYRef.current += (target - doorYRef.current) * 0.055;
    doorGroupRef.current.position.y = doorYRef.current;
  });

  return (
    <group position={[portOffsetX, 0, 0]}>
      {/* Stencil cutter — punches hole through full wall at door opening */}
      <mesh renderOrder={-2} position={[0, targetH / 2, lengthMm / 2000 - WALL_T / 2]} material={matCut}>
        <boxGeometry args={[targetW, targetH, WALL_T + 0.1]} />
      </mesh>
      {/* Door panel — animates in Y */}
      <group ref={doorGroupRef}>
        <primitive object={group.clone} position={[group.ox, group.oy, group.oz + doorZ]} dispose={null} />
      </group>
    </group>
  );
}

function GarageDimensionLines({ lengthMm, widthMm, wallHalfL, wallHalfW }: {
  lengthMm: number; widthMm: number; wallHalfL: number | null; wallHalfW: number | null;
}) {
  const halfL = wallHalfL ?? (lengthMm / 2000);
  const halfW = wallHalfW ?? (widthMm  / 2000);
  const y   = -0.05;
  const gap = 0.55;
  const ext = 0.1;
  const wColor = ((widthMm  - 200) % 600 === 0) ? "#16a34a" : "#e2520a";
  const lColor = (lengthMm % 600 === 0) ? "#16a34a" : "#2563eb";
  return (
    <>
      <DimensionLine start={[-halfW, y, halfL + gap]} end={[halfW, y, halfL + gap]} label={`${(widthMm / 1000).toFixed(1)} m`} color={wColor} />
      <Line points={[[-halfW, y, halfL], [-halfW, y, halfL + gap + ext]]} color={wColor} lineWidth={1} />
      <Line points={[[ halfW, y, halfL], [ halfW, y, halfL + gap + ext]]} color={wColor} lineWidth={1} />
      <DimensionLine start={[halfW + gap, y, -halfL]} end={[halfW + gap, y, halfL]} label={`${(lengthMm / 1000).toFixed(1)} m`} color={lColor} />
      <Line points={[[halfW, y, -halfL], [halfW + gap + ext, y, -halfL]]} color={lColor} lineWidth={1} />
      <Line points={[[halfW, y,  halfL], [halfW + gap + ext, y,  halfL]]} color={lColor} lineWidth={1} />
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

export default function GarageViewer({ lengthMm, widthMm, doorWidthMm, doorHeightMm, doorColor = "hvit", roofType, addedElements = [], buildingType, rotationDeg, demoDoorOpen = false, autoRotate = false }: GarageViewerProps) {
  const orbitRef = useRef<OrbitControlsImpl>(null);
  const [wallHalfL, setWallHalfL] = useState<number | null>(null);
  const [wallHalfW, setWallHalfW] = useState<number | null>(null);

  // Reset wall faces when the model type changes so old values don't linger
  useEffect(() => {
    setWallHalfL(null);
    setWallHalfW(null);
  }, [roofType, buildingType]);

  const handleWallFaces = useCallback((halfL: number, halfW: number) => {
    setWallHalfL(halfL);
    setWallHalfW(halfW);
  }, []);

  const hasGarage = buildingType !== "carport";
  const hasFlatGarage = roofType === "flattak" && hasGarage;
  const portOffsetX = hasGarage
    ? computePortOffset(addedElements.filter(e => e.side === "front"), widthMm / 1000, doorWidthMm / 1000)
    : 0;

  return (
    <div className="relative h-full w-full">
      <Canvas
        shadows
        camera={{ position: [12, 7, 12], fov: 42 }}
        gl={{ toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0, stencil: true }}
      >
        <>
          <color attach="background" args={["#f5f5f4"]} />
          <ambientLight intensity={0.6} />
          <directionalLight position={[10, 15, 10]} intensity={1.2} castShadow shadow-mapSize={[2048, 2048]} />
        </>

        <GltfErrorBoundary onError={(msg) => console.error("3D-feil:", msg)}>
          <Suspense fallback={null}>
            <GarageModel
              key={`${buildingType ?? "garasje"}-${roofType ?? "saltak"}`}
              lengthMm={lengthMm} widthMm={widthMm} roofType={roofType}
              buildingType={buildingType} rotationDeg={rotationDeg}
              onWallFaces={handleWallFaces}
            />
            {hasGarage && (
              <GaragePortFlat lengthMm={lengthMm} doorWidthMm={doorWidthMm} doorHeightMm={doorHeightMm} portOffsetX={portOffsetX} demoDoorOpen={demoDoorOpen} doorColor={doorColor} roofType={roofType} />
            )}
          </Suspense>
        </GltfErrorBoundary>
        <GarageWindowElements
          elements={addedElements}
          lengthM={lengthMm / 1000} widthM={widthMm / 1000}
          halfLOverride={wallHalfL ?? undefined}
          halfWOverride={wallHalfW ?? undefined}
          doorWidthM={doorWidthMm / 1000}
          hasFlatRoof={hasFlatGarage}
          portOffsetX={portOffsetX}
        />
        <GarageDimensionLines lengthMm={lengthMm} widthMm={widthMm} wallHalfL={wallHalfL} wallHalfW={wallHalfW} />

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
          autoRotate={autoRotate}
          autoRotateSpeed={0.8}
        />

        <GizmoHelper alignment="bottom-left" margin={[50, 50]}>
          <GizmoViewport axisColors={["#e2520a", "#22c55e", "#2563eb"]} labelColor="#fff" axisHeadScale={0.6} hideNegativeAxes={true} />
        </GizmoHelper>
      </Canvas>
    </div>
  );
}

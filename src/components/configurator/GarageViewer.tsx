"use client";

import { useRef, useEffect, Suspense, Component, type ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import { OrbitControls, Environment, Grid, useGLTF, Line, Text } from "@react-three/drei";
import { Box3, Vector3, Mesh, MeshStandardMaterial } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

interface GarageViewerProps {
  lengthMm: number;
  widthMm: number;
  doorWidthMm: number;
  doorHeightMm: number;
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

function GarageModel({ lengthMm, widthMm }: { lengthMm: number; widthMm: number }) {
  const { scene } = useGLTF("/garasje.glb");
  const boxRef = useRef<Box3 | null>(null);

  useEffect(() => {
    // GLB/GLTF is Y-up — no axis rotation needed. Try flipping to face front.
    scene.rotation.set(0, Math.PI, 0);
    scene.scale.set(1, 1, 1);
    scene.updateMatrixWorld(true);

    const box = new Box3().setFromObject(scene);
    const size = box.getSize(new Vector3());

    const targetWidth  = widthMm  / 1000;
    const targetLength = lengthMm / 1000;

    const scaleX = size.x > 0 ? targetWidth  / size.x : 1;
    const scaleZ = size.z > 0 ? targetLength / size.z : 1;
    const scaleY = (scaleX + scaleZ) / 2;

    scene.scale.set(scaleX, scaleY, scaleZ);
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

export default function GarageViewer({ lengthMm, widthMm }: GarageViewerProps) {
  const orbitRef = useRef<OrbitControlsImpl>(null);

  return (
    <div className="relative h-full w-full">
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
            <GarageModel lengthMm={lengthMm} widthMm={widthMm} />
          </Suspense>
        </GltfErrorBoundary>

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

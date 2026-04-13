"use client";

import { useRef, useState, useEffect, Suspense, Component, type ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import { OrbitControls, Grid, useGLTF } from "@react-three/drei";
import { Box3, Vector3, Mesh, MeshStandardMaterial } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

interface GarageViewerProps {
  lengthMm: number;
  widthMm: number;
  doorWidthMm: number;
  doorHeightMm: number;
}

/** Renders the GLTF scene, rotated from Z-up to Y-up and centred */
function GarageModel({ url }: { url: string }) {
  const { scene } = useGLTF(url);

  useEffect(() => {
    scene.rotation.set(-Math.PI / 2, 0, 0);
    scene.updateMatrixWorld(true);
    const box = new Box3().setFromObject(scene);
    const center = box.getCenter(new Vector3());
    scene.position.set(-center.x, -box.min.y, -center.z);

    // Override all materials with flat brand colour (no realistic textures)
    const flatMat = new MeshStandardMaterial({
      color: new THREE.Color("#e2520a"),
      roughness: 1.0,
      metalness: 0.0,
      envMapIntensity: 0,
    });
    scene.traverse((child) => {
      if (child instanceof Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        child.material = flatMat;
      }
    });
  }, [scene]);

  return <primitive object={scene} dispose={null} />;
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

export default function GarageViewer({ lengthMm, widthMm, doorWidthMm, doorHeightMm }: GarageViewerProps) {
  const orbitRef = useRef<OrbitControlsImpl>(null);
  const [modelUrl, setModelUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initialLoaded = useRef(false);

  async function loadModel() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/onshape/model?length=${lengthMm}&width=${widthMm}&doorWidth=${doorWidthMm}&doorHeight=${doorHeightMm}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      setModelUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(blob);
      });
      initialLoaded.current = true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ukjent feil");
    } finally {
      setLoading(false);
    }
  }

  // Load on mount
  useEffect(() => {
    loadModel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-reload when dimensions change (1.5 s debounce, after initial load)
  useEffect(() => {
    if (!initialLoaded.current) return;
    const timer = setTimeout(loadModel, 1500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lengthMm, widthMm, doorWidthMm, doorHeightMm]);

  // Revoke blob URL on unmount
  useEffect(() => {
    return () => {
      if (modelUrl) URL.revokeObjectURL(modelUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative h-full w-full">
      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-stone-100/70">
          <div className="rounded-full bg-white px-5 py-2 text-sm text-gray-500 shadow">
            Laster 3D-modell…
          </div>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="absolute top-3 right-3 z-10 max-w-xs rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          <strong>Feil:</strong> {error}
        </div>
      )}

      <Canvas
        shadows
        camera={{ position: [12, 7, 12], fov: 42 }}
        gl={{ toneMapping: THREE.NoToneMapping }}
      >
        <color attach="background" args={["#f0f0ef"]} />
        <ambientLight intensity={0.75} />
        <directionalLight
          position={[10, 15, 10]}
          intensity={1.4}
          castShadow
          shadow-mapSize={[2048, 2048]}
        />
        <directionalLight position={[-8, 6, -6]} intensity={0.3} />

        {modelUrl && (
          <GltfErrorBoundary onError={(msg) => setError(`3D-feil: ${msg}`)}>
            <Suspense fallback={null}>
              <GarageModel url={modelUrl} />
            </Suspense>
          </GltfErrorBoundary>
        )}

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

        {/* No environment map — keeps the flat non-realistic look */}

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

      {/* Refresh button */}
      {modelUrl && !loading && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
          <button
            onClick={loadModel}
            className="rounded-full bg-black/40 px-4 py-1.5 text-xs text-white hover:bg-black/60"
          >
            ↺ Oppdater 3D-visning
          </button>
        </div>
      )}
    </div>
  );
}

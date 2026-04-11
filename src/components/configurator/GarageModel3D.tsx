"use client";

import { useRef, useState } from "react";
import { useThree } from "@react-three/fiber";
import { Line, Text } from "@react-three/drei";
import type { Group } from "three";

const STEP_M = 0.6;
const MIN_M = 0.6;
const MAX_M = 12;

function snapToStep(v: number) {
  return Math.round(v / STEP_M) * STEP_M;
}

/** Architectural dimension line with arrows and a text label */
function DimensionLine({
  from,
  to,
  labelPos,
  label,
  axis,
}: {
  from: [number, number, number];
  to: [number, number, number];
  labelPos: [number, number, number];
  label: string;
  axis: "x" | "z";
}) {
  const arrowLen = 0.25;
  const lineColor = "#374151";

  // Arrow at 'from' end
  const fromArrow: [number, number, number][] =
    axis === "x"
      ? [[from[0] + arrowLen, from[1], from[2]], from]
      : [[from[0], from[1], from[2] + arrowLen], from];

  // Arrow at 'to' end
  const toArrow: [number, number, number][] =
    axis === "x"
      ? [[to[0] - arrowLen, to[1], to[2]], to]
      : [[to[0], to[1], to[2] - arrowLen], to];

  return (
    <group>
      {/* Main dimension line */}
      <Line points={[from, to]} color={lineColor} lineWidth={1.5} />
      {/* Arrow heads */}
      <Line points={fromArrow} color={lineColor} lineWidth={2.5} />
      <Line points={toArrow} color={lineColor} lineWidth={2.5} />
      {/* Label */}
      <Text
        position={labelPos}
        fontSize={0.28}
        color={lineColor}
        anchorX="center"
        anchorY="middle"
        outlineColor="#ffffff"
        outlineWidth={0.04}
      >
        {label}
      </Text>
    </group>
  );
}

interface GarageModel3DProps {
  lengthM: number;
  widthM?: number;
  heightM?: number;
  onLengthChange?: (mm: number) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}

export default function GarageModel3D({
  lengthM,
  widthM = 4,
  heightM = 2.5,
  onLengthChange,
  onDragStart,
  onDragEnd,
}: GarageModel3DProps) {
  const groupRef = useRef<Group>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [wallHovered, setWallHovered] = useState(false);
  const { gl } = useThree();

  const startXRef = useRef(0);
  const startLengthRef = useRef(lengthM);

  function handlePointerDown(e: { stopPropagation: () => void; clientX: number }) {
    e.stopPropagation();
    setIsDragging(true);
    startXRef.current = e.clientX;
    startLengthRef.current = lengthM;
    gl.domElement.style.cursor = "ew-resize";
    onDragStart?.();
  }

  function handlePointerMove(e: { clientX: number }) {
    if (!isDragging) return;
    const deltaX = e.clientX - startXRef.current;
    const newLength = startLengthRef.current + deltaX * 0.05;
    const snapped = snapToStep(Math.max(MIN_M, Math.min(MAX_M, newLength)));
    onLengthChange?.(Math.round(snapped * 1000));
  }

  function handlePointerUp() {
    if (!isDragging) return;
    setIsDragging(false);
    gl.domElement.style.cursor = wallHovered ? "ew-resize" : "auto";
    onDragEnd?.();
  }

  const wallThickness = 0.15;
  const roofOverhang = 0.3;
  const roofHeight = 0.8;

  const wallColor = "#2d3748";
  const roofColor = "#e2520a";
  const doorColor = "#d1d5db";
  const floorColor = "#9ca3af";

  // Right wall glows orange when hovered or dragging
  const rightWallColor = wallHovered || isDragging ? "#e2520a" : wallColor;

  // Dimension line positions (below the garage)
  const dimY = -0.55;
  const lengthDimZ = widthM / 2 + 1.0;  // in front of garage
  const widthDimX = lengthM / 2 + 1.2;  // to the right of garage

  const lengthLabel = `${lengthM.toFixed(1)} m`;
  const widthLabel = `${widthM.toFixed(1)} m`;

  return (
    <group
      ref={groupRef}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      {/* ── Structure ── */}

      {/* Floor */}
      <mesh position={[0, -0.01, 0]} receiveShadow>
        <boxGeometry args={[lengthM, 0.05, widthM]} />
        <meshStandardMaterial color={floorColor} roughness={0.8} />
      </mesh>

      {/* Back wall */}
      <mesh position={[0, heightM / 2, -widthM / 2 + wallThickness / 2]} castShadow receiveShadow>
        <boxGeometry args={[lengthM, heightM, wallThickness]} />
        <meshStandardMaterial color={wallColor} roughness={0.7} />
      </mesh>

      {/* Left wall */}
      <mesh position={[-lengthM / 2 + wallThickness / 2, heightM / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[wallThickness, heightM, widthM]} />
        <meshStandardMaterial color={wallColor} roughness={0.7} />
      </mesh>

      {/* Right wall — DRAGGABLE */}
      <mesh
        position={[lengthM / 2 - wallThickness / 2, heightM / 2, 0]}
        castShadow
        receiveShadow
        onPointerDown={handlePointerDown}
        onPointerEnter={() => {
          setWallHovered(true);
          gl.domElement.style.cursor = "ew-resize";
        }}
        onPointerLeave={() => {
          setWallHovered(false);
          if (!isDragging) gl.domElement.style.cursor = "auto";
        }}
      >
        <boxGeometry args={[wallThickness + 0.05, heightM, widthM]} />
        <meshStandardMaterial color={rightWallColor} roughness={0.7} />
      </mesh>

      {/* Drag hint arrow on right wall */}
      {(wallHovered || isDragging) && (
        <>
          <mesh position={[lengthM / 2 + 0.5, heightM / 2, 0]}>
            <boxGeometry args={[0.6, 0.07, 0.07]} />
            <meshStandardMaterial color="#ffffff" roughness={0.3} />
          </mesh>
          <mesh position={[lengthM / 2 + 0.85, heightM / 2, 0]} rotation={[0, 0, -Math.PI / 2]}>
            <coneGeometry args={[0.14, 0.3, 12]} />
            <meshStandardMaterial color="#ffffff" roughness={0.3} />
          </mesh>
        </>
      )}

      {/* Front wall — left pillar */}
      <mesh position={[-lengthM / 2 + wallThickness / 2, heightM / 2, widthM / 2 - wallThickness / 2]} castShadow receiveShadow>
        <boxGeometry args={[wallThickness, heightM, wallThickness]} />
        <meshStandardMaterial color={wallColor} roughness={0.7} />
      </mesh>

      {/* Front wall — right pillar */}
      <mesh position={[lengthM / 2 - wallThickness / 2, heightM / 2, widthM / 2 - wallThickness / 2]} castShadow receiveShadow>
        <boxGeometry args={[wallThickness, heightM, wallThickness]} />
        <meshStandardMaterial color={wallColor} roughness={0.7} />
      </mesh>

      {/* Garage door — scales with building length */}
      {(() => {
        const doorW = lengthM - wallThickness * 2 - 0.1;
        const doorH = heightM - 0.1;
        const panelH = doorH / 4;
        return (
          <>
            <mesh position={[0, doorH / 2 + 0.05, widthM / 2 - wallThickness / 2 + 0.01]} castShadow>
              <boxGeometry args={[doorW, doorH, 0.05]} />
              <meshStandardMaterial color={doorColor} roughness={0.4} metalness={0.3} />
            </mesh>
            {[0, 1, 2, 3].map((i) => (
              <mesh key={i} position={[0, panelH * i + panelH / 2 + 0.05, widthM / 2 - wallThickness / 2 + 0.04]}>
                <boxGeometry args={[doorW - 0.05, 0.04, 0.01]} />
                <meshStandardMaterial color="#9ca3af" />
              </mesh>
            ))}
          </>
        );
      })()}

      {/* Roof — left slope */}
      <mesh
        position={[-lengthM / 4, heightM + roofHeight / 2, 0]}
        rotation={[0, 0, Math.atan2(roofHeight, lengthM / 2)]}
        castShadow
      >
        <boxGeometry args={[Math.sqrt((lengthM / 2) ** 2 + roofHeight ** 2) + roofOverhang, 0.12, widthM + roofOverhang * 2]} />
        <meshStandardMaterial color={roofColor} roughness={0.6} />
      </mesh>

      {/* Roof — right slope */}
      <mesh
        position={[lengthM / 4, heightM + roofHeight / 2, 0]}
        rotation={[0, 0, -Math.atan2(roofHeight, lengthM / 2)]}
        castShadow
      >
        <boxGeometry args={[Math.sqrt((lengthM / 2) ** 2 + roofHeight ** 2) + roofOverhang, 0.12, widthM + roofOverhang * 2]} />
        <meshStandardMaterial color={roofColor} roughness={0.6} />
      </mesh>


      {/* ── Dimension lines ── */}

      {/* Extension lines — length (front edge down to dim line) */}
      <Line points={[[- lengthM / 2, 0, widthM / 2], [-lengthM / 2, dimY, lengthDimZ]]} color="#6b7280" lineWidth={1} />
      <Line points={[[lengthM / 2, 0, widthM / 2], [lengthM / 2, dimY, lengthDimZ]]} color="#6b7280" lineWidth={1} />

      {/* Length dimension */}
      <DimensionLine
        from={[-lengthM / 2, dimY, lengthDimZ]}
        to={[lengthM / 2, dimY, lengthDimZ]}
        labelPos={[0, dimY, lengthDimZ + 0.4]}
        label={lengthLabel}
        axis="x"
      />

      {/* Extension lines — width (right edge to dim line) */}
      <Line points={[[lengthM / 2, 0, -widthM / 2], [widthDimX, dimY, -widthM / 2]]} color="#6b7280" lineWidth={1} />
      <Line points={[[lengthM / 2, 0, widthM / 2], [widthDimX, dimY, widthM / 2]]} color="#6b7280" lineWidth={1} />

      {/* Width dimension */}
      <DimensionLine
        from={[widthDimX, dimY, -widthM / 2]}
        to={[widthDimX, dimY, widthM / 2]}
        labelPos={[widthDimX + 0.5, dimY, 0]}
        label={widthLabel}
        axis="z"
      />
    </group>
  );
}

"use client";

import type { AddedElement, WallSide } from "./DoorWindowAdder";

interface Props {
  widthMm: number;
  lengthMm: number;
  doorWidthMm: number;
  doorHeightMm: number;
  roofType?: "saltak" | "flattak";
  buildingType?: string;
  addedElements: AddedElement[];
}

const WALL_H_MM = 3000;
const DOOR_W_MM = 2500;
const DOOR_H_MM = 2125;
const WALL_T_MM = 120;

const EL_W: Record<string, number> = { door: 900, window1: 1000, window2: 1000, window3: 1000 };
const EL_H: Record<string, number> = { door: 2100, window1: 500,  window2: 600,  window3: 1000 };
const EL_Y: Record<string, number> = { door: 0,    window1: 900,  window2: 900,  window3: 900  };
const EL_LABEL: Record<string, string> = {
  door: "Dør", window1: "Vindu 100×50", window2: "Vindu 100×60", window3: "Vindu 100×100",
};

const SIDE_LABELS: Record<WallSide, string> = {
  front: "Frontvegg", back: "Bakvegg", left: "Venstre vegg", right: "Høyre vegg",
};

const WALL_ORDER: WallSide[] = ["front", "back", "left", "right"];

// ─── SVG helpers ──────────────────────────────────────────────────────────────

const SCALE   = 0.09;   // mm → px
const DIM_GAP = 28;     // px from wall edge to first dim line
const DIM_INC = 20;     // px between stacked dim lines
const ARROW   = 5;
const FONT    = 10;

function px(mm: number) { return mm * SCALE; }

interface DimLineProps {
  x1: number; y1: number; x2: number; y2: number;
  label: string; offset?: number; color?: string; vertical?: boolean;
}

function DimLine({ x1, y1, x2, y2, label, offset = 0, color = "#2563eb", vertical = false }: DimLineProps) {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const len = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
  if (len < 4) return null;

  const ax = ((x2 - x1) / len) * ARROW;
  const ay = ((y2 - y1) / len) * ARROW;

  const angle = vertical ? -90 : 0;

  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={1} markerEnd="none" />
      {/* Arrow heads */}
      <polygon points={`${x1},${y1} ${x1 + ax + ay * 0.4},${y1 + ay - ax * 0.4} ${x1 + ax - ay * 0.4},${y1 + ay + ax * 0.4}`} fill={color} />
      <polygon points={`${x2},${y2} ${x2 - ax + ay * 0.4},${y2 - ay - ax * 0.4} ${x2 - ax - ay * 0.4},${y2 - ay + ax * 0.4}`} fill={color} />
      <text
        x={mx} y={my - 3 + offset}
        textAnchor="middle" dominantBaseline="auto"
        fontSize={FONT} fill={color} fontWeight="600"
        transform={angle !== 0 ? `rotate(${angle}, ${mx}, ${my})` : undefined}
      >
        {label}
      </text>
    </g>
  );
}

function WallElevation({
  wallMm, wallLabel, elements, isGarageFront, roofType,
}: {
  wallMm: number; wallLabel: string; elements: AddedElement[];
  isGarageFront: boolean; roofType?: string;
}) {
  const W    = px(wallMm);
  const H    = px(WALL_H_MM);
  const PAD  = 60;
  const SVG_W = W + PAD * 2 + DIM_GAP * 3;
  const SVG_H = H + PAD + DIM_GAP * 3 + 30;

  const ox = PAD;   // wall left edge in SVG
  const oy = PAD;   // wall top edge in SVG

  // Resolve element positions
  const placed: { elW: number; elH: number; elY: number; x: number; label: string; key: string }[] = [];
  const GAP_FROM_EDGE = 150; // mm from wall edge for left/right placed elements

  if (isGarageFront && roofType === "flattak") {
    const gx = (wallMm - DOOR_W_MM) / 2;
    placed.push({ elW: DOOR_W_MM, elH: DOOR_H_MM, elY: 0, x: gx, label: `Port ${DOOR_W_MM}×${DOOR_H_MM}mm`, key: "port" });
  }

  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    const elW = EL_W[el.category] ?? 1000;
    const elH = EL_H[el.category] ?? 600;
    const elY = EL_Y[el.category] ?? 900;
    const label = EL_LABEL[el.category] ?? el.category;

    const positions = el.placement === "both"
      ? ["left" as const, "right" as const]
      : [el.placement];

    for (const pos of positions) {
      const x = pos === "left" ? GAP_FROM_EDGE : wallMm - GAP_FROM_EDGE - elW;
      placed.push({ elW, elH, elY, x, label, key: `${i}-${pos}` });
    }
  }

  return (
    <div className="mb-8">
      <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">{wallLabel}</h3>
      <div className="overflow-x-auto">
        <svg width={SVG_W} height={SVG_H} style={{ background: "#f9fafb", borderRadius: 8, border: "1px solid #e5e7eb" }}>

          {/* Wall outline */}
          <rect x={ox} y={oy} width={W} height={H} fill="#e5e7eb" stroke="#6b7280" strokeWidth={1.5} />

          {/* Elements */}
          {placed.map(({ elW, elH, elY, x, label, key }) => {
            const ex = ox + px(x);
            const ey = oy + H - px(elY + elH);
            const ew = px(elW);
            const eh = px(elH);
            const isPort = key === "port";
            return (
              <g key={key}>
                <rect x={ex} y={ey} width={ew} height={eh}
                  fill={isPort ? "#bfdbfe" : "#fed7aa"} stroke={isPort ? "#2563eb" : "#f97316"} strokeWidth={1.5} />
                <text x={ex + ew / 2} y={ey + eh / 2} textAnchor="middle" dominantBaseline="middle"
                  fontSize={9} fill={isPort ? "#1d4ed8" : "#9a3412"} fontWeight="600">
                  {label}
                </text>
              </g>
            );
          })}

          {/* Ground line */}
          <line x1={ox - 8} y1={oy + H} x2={ox + W + 8} y2={oy + H} stroke="#374151" strokeWidth={2} />
          <text x={ox - 10} y={oy + H + 12} fontSize={9} fill="#6b7280">±0</text>

          {/* Total width dim line (top) */}
          <DimLine
            x1={ox} y1={oy - DIM_GAP} x2={ox + W} y2={oy - DIM_GAP}
            label={`${wallMm} mm`} color="#374151"
          />

          {/* Wall height dim line (right side) */}
          <DimLine
            x1={ox + W + DIM_GAP} y1={oy + H} x2={ox + W + DIM_GAP} y2={oy}
            label={`${WALL_H_MM} mm`} color="#374151" vertical
          />

          {/* Per-element dimension lines */}
          {placed.map(({ elW, elH, elY, x, key }, idx) => {
            const ex  = ox + px(x);
            const ey  = oy + H - px(elY + elH);
            const ew  = px(elW);
            const eh  = px(elH);
            const dimY = oy + H + DIM_GAP + idx * DIM_INC;
            const dimX = ox + W + DIM_GAP * 2 + idx * DIM_INC;
            const isPort = key === "port";
            const col = isPort ? "#2563eb" : "#ea580c";
            return (
              <g key={key}>
                {/* Width dim below wall */}
                <line x1={ex} y1={oy + H + 4} x2={ex} y2={dimY + 2} stroke={col} strokeWidth={0.8} strokeDasharray="3 2" />
                <line x1={ex + ew} y1={oy + H + 4} x2={ex + ew} y2={dimY + 2} stroke={col} strokeWidth={0.8} strokeDasharray="3 2" />
                <DimLine x1={ex} y1={dimY} x2={ex + ew} y2={dimY} label={`${elW} mm`} color={col} />

                {/* Height dim right of wall */}
                <line x1={ox + W + 4} y1={ey} x2={dimX - 2} y2={ey} stroke={col} strokeWidth={0.8} strokeDasharray="3 2" />
                <line x1={ox + W + 4} y1={ey + eh} x2={dimX - 2} y2={ey + eh} stroke={col} strokeWidth={0.8} strokeDasharray="3 2" />
                <DimLine x1={dimX} y1={ey} x2={dimX} y2={ey + eh} label={`${elH} mm`} color={col} vertical />

                {/* Bottom height (from floor) */}
                {elY > 0 && (
                  <>
                    <line x1={ox + W + 4} y1={oy + H} x2={dimX + DIM_INC - 2} y2={oy + H} stroke={col} strokeWidth={0.8} strokeDasharray="3 2" />
                    <DimLine x1={dimX + DIM_INC} y1={ey + eh} x2={dimX + DIM_INC} y2={oy + H} label={`${elY} mm`} color={col} vertical />
                  </>
                )}

                {/* Distance from left edge */}
                {x > 0 && (
                  <DimLine
                    x1={ox} y1={oy + H + DIM_GAP + (idx + placed.length) * DIM_INC}
                    x2={ex} y2={oy + H + DIM_GAP + (idx + placed.length) * DIM_INC}
                    label={`${x} mm`} color="#6b7280"
                  />
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

export default function GarageMålAdmin({ widthMm, lengthMm, addedElements, roofType, buildingType, doorWidthMm }: Props) {
  if (buildingType === "carport") return (
    <div className="p-6 text-sm text-gray-400">Målsetting ikke tilgjengelig for carport.</div>
  );

  return (
    <div className="p-4 sm:p-6 overflow-y-auto">
      <h2 className="text-base font-bold text-gray-900 mb-1">Målsetting — admin</h2>
      <p className="text-xs text-gray-500 mb-6">Høyde- og breddeplassering for alle elementer på veggene.</p>

      {WALL_ORDER.map((side) => {
        const wallMm   = (side === "left" || side === "right") ? lengthMm : widthMm;
        const els      = addedElements.filter((e) => e.side === side);
        const isFront  = side === "front";
        const hasItems = els.length > 0 || (isFront && roofType === "flattak");
        if (!hasItems) return null;
        return (
          <WallElevation
            key={side}
            wallMm={wallMm}
            wallLabel={SIDE_LABELS[side]}
            elements={els}
            isGarageFront={isFront}
            roofType={roofType}
          />
        );
      })}

      {WALL_ORDER.every((side) => {
        const els = addedElements.filter((e) => e.side === side);
        const isFront = side === "front";
        return els.length === 0 && !(isFront && roofType === "flattak");
      }) && (
        <p className="text-sm text-gray-400 mt-4">Ingen dører eller vinduer lagt til ennå.</p>
      )}
    </div>
  );
}

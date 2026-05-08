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

// Mirror constants from GarageViewer
const WALL_H_MM = 3000;

// Element dimensions (mm) — must match GarageViewer getElDims
const EL_W_MM: Record<string, number> = { door: 900,  window1: 1000, window2: 1000, window3: 1000 };
const EL_H_MM: Record<string, number> = { door: 2100, window1: 500,  window2: 600,  window3: 1000 };
// cy in 3D is center height from ground (metres). door = h/2, windows = WALL_H*0.55
const EL_CY_MM: Record<string, number> = {
  door:    1050,
  window1: 1650,
  window2: 1650,
  window3: 1650,
};

const EL_LABEL: Record<string, string> = {
  door: "Dør 900×2100", window1: "Vindu 1000×500", window2: "Vindu 1000×600", window3: "Vindu 1000×1000",
};

const SIDE_LABELS: Record<WallSide, string> = {
  front: "Frontvegg", back: "Bakvegg", left: "Venstre vegg", right: "Høyre vegg",
};

const WALL_ORDER: WallSide[] = ["front", "back", "left", "right"];

// ─── SVG helpers ──────────────────────────────────────────────────────────────
const SCALE   = 0.085;
const PAD     = 55;
const DIM_OFF = 26;   // gap from wall edge to first dim line
const ARROW   = 5;
const FONT    = 10;

function px(mm: number) { return mm * SCALE; }

function Dim({ x1, y1, x2, y2, label, color = "#374151" }: {
  x1: number; y1: number; x2: number; y2: number; label: string; color?: string;
}) {
  const len = Math.hypot(x2 - x1, y2 - y1);
  if (len < 6) return null;
  const mx  = (x1 + x2) / 2;
  const my  = (y1 + y2) / 2;
  const ux  = (x2 - x1) / len;
  const uy  = (y2 - y1) / len;
  const isV = Math.abs(ux) < 0.3;

  // Arrow heads
  const a1 = `${x1},${y1} ${x1 + ux * ARROW + uy * ARROW * 0.45},${y1 + uy * ARROW - ux * ARROW * 0.45} ${x1 + ux * ARROW - uy * ARROW * 0.45},${y1 + uy * ARROW + ux * ARROW * 0.45}`;
  const a2 = `${x2},${y2} ${x2 - ux * ARROW + uy * ARROW * 0.45},${y2 - uy * ARROW - ux * ARROW * 0.45} ${x2 - ux * ARROW - uy * ARROW * 0.45},${y2 - uy * ARROW + ux * ARROW * 0.45}`;

  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={1} />
      <polygon points={a1} fill={color} />
      <polygon points={a2} fill={color} />
      <text
        x={mx} y={my}
        textAnchor="middle" dominantBaseline="middle"
        fontSize={FONT} fill={color} fontWeight="600"
        transform={isV ? `rotate(-90,${mx},${my})` : undefined}
        dy={isV ? 0 : -4}
      >
        {label}
      </text>
    </g>
  );
}

interface Placed {
  xMm: number;   // left edge of element, mm from wall left edge
  yMm: number;   // bottom edge of element, mm from ground
  wMm: number;
  hMm: number;
  label: string;
  isPort: boolean;
  key: string;
}

function resolvePlacements(
  wallMm: number,
  elements: AddedElement[],
  isGarageFront: boolean,
  roofType: string | undefined,
  doorWidthMm: number,
  doorHeightMm: number,
): Placed[] {
  const result: Placed[] = [];

  // Garage door — centred on front wall, bottom at ground
  if (isGarageFront && roofType === "flattak") {
    const wMm = doorWidthMm;
    const hMm = doorHeightMm;
    result.push({
      xMm: (wallMm - wMm) / 2,
      yMm: 0,
      wMm, hMm,
      label: `Port ${wMm}×${hMm} mm`,
      isPort: true,
      key: "port",
    });
  }

  // Doors & windows
  const DOOR_SIDE_GAP_MM = 150;
  elements.forEach((el, i) => {
    const wMm   = EL_W_MM[el.category] ?? 1000;
    const hMm   = EL_H_MM[el.category] ?? 600;
    const cyMm  = EL_CY_MM[el.category] ?? 1500;
    const yMm   = cyMm - hMm / 2;

    // Signs matching GarageViewer: "left"→+1, "right"→-1
    const signs = el.placement === "both" ? [1, -1] : el.placement === "left" ? [1] : [-1];

    signs.forEach((sign, pi) => {
      // Front wall with port: place adjacent to port; all other walls use fixed frac
      const cxMm = (isGarageFront && roofType === "flattak")
        ? wallMm / 2 + sign * (doorWidthMm / 2 + DOOR_SIDE_GAP_MM + wMm / 2)
        : wallMm / 2 + sign * wallMm * 0.25;
      result.push({
        xMm: cxMm - wMm / 2,
        yMm,
        wMm, hMm,
        label: EL_LABEL[el.category] ?? el.category,
        isPort: false,
        key: `${i}-${pi}`,
      });
    });
  });

  return result;
}

function WallElevation({
  wallMm, wallLabel, elements, isGarageFront, roofType, doorWidthMm, doorHeightMm,
}: {
  wallMm: number; wallLabel: string; elements: AddedElement[];
  isGarageFront: boolean; roofType?: string;
  doorWidthMm: number; doorHeightMm: number;
}) {
  const placed = resolvePlacements(wallMm, elements, isGarageFront, roofType, doorWidthMm, doorHeightMm);
  if (placed.length === 0) return null;

  const W    = px(wallMm);
  const H    = px(WALL_H_MM);
  const extraRight = DIM_OFF * 3 + 20;
  const extraBottom = DIM_OFF * (placed.length + 2) + 20;
  const SVG_W = W + PAD * 2 + extraRight;
  const SVG_H = H + PAD + extraBottom;
  const ox = PAD;
  const oy = PAD;

  return (
    <div className="mb-8">
      <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">{wallLabel}</h3>
      <div className="overflow-x-auto pb-2">
        <svg width={SVG_W} height={SVG_H} style={{ background: "#f9fafb", borderRadius: 8, border: "1px solid #e5e7eb" }}>

          {/* Wall */}
          <rect x={ox} y={oy} width={W} height={H} fill="#e2e8f0" stroke="#475569" strokeWidth={1.5} />

          {/* Ground */}
          <line x1={ox - 6} y1={oy + H} x2={ox + W + 6} y2={oy + H} stroke="#1e293b" strokeWidth={2} />
          <text x={ox - 8} y={oy + H + 13} fontSize={9} fill="#64748b">±0</text>

          {/* Elements */}
          {placed.map(({ xMm, yMm, wMm, hMm, label, isPort, key }) => {
            const ex = ox + px(xMm);
            const ey = oy + H - px(yMm + hMm);
            const ew = px(wMm);
            const eh = px(hMm);
            return (
              <g key={key}>
                <rect x={ex} y={ey} width={ew} height={eh}
                  fill={isPort ? "#bfdbfe" : "#fed7aa"}
                  stroke={isPort ? "#1d4ed8" : "#ea580c"}
                  strokeWidth={1.5}
                />
                <text x={ex + ew / 2} y={ey + eh / 2}
                  textAnchor="middle" dominantBaseline="middle"
                  fontSize={8} fill={isPort ? "#1e3a8a" : "#9a3412"} fontWeight="700">
                  {label}
                </text>
              </g>
            );
          })}

          {/* ── Dim: total wall width (above) ── */}
          <Dim x1={ox} y1={oy - DIM_OFF} x2={ox + W} y2={oy - DIM_OFF} label={`${wallMm} mm`} />
          {/* ── Dim: wall height (right) ── */}
          <Dim x1={ox + W + DIM_OFF} y1={oy + H} x2={ox + W + DIM_OFF} y2={oy} label={`${WALL_H_MM} mm`} color="#475569" />

          {/* ── Per-element dims ── */}
          {placed.map(({ xMm, yMm, wMm, hMm, isPort, key }, idx) => {
            const ex  = ox + px(xMm);
            const ey  = oy + H - px(yMm + hMm);
            const ew  = px(wMm);
            const eh  = px(hMm);
            const col = isPort ? "#1d4ed8" : "#ea580c";
            const dimY   = oy + H + DIM_OFF + idx * DIM_OFF;
            const dimX   = ox + W + DIM_OFF * 2 + idx * DIM_OFF;

            return (
              <g key={key}>
                {/* Width below */}
                <line x1={ex}      y1={oy + H + 3} x2={ex}      y2={dimY - 3} stroke={col} strokeWidth={0.7} strokeDasharray="3 2" />
                <line x1={ex + ew} y1={oy + H + 3} x2={ex + ew} y2={dimY - 3} stroke={col} strokeWidth={0.7} strokeDasharray="3 2" />
                <Dim x1={ex} y1={dimY} x2={ex + ew} y2={dimY} label={`${wMm} mm`} color={col} />

                {/* Height right */}
                <line x1={ox + W + 3} y1={ey}      x2={dimX - 3} y2={ey}      stroke={col} strokeWidth={0.7} strokeDasharray="3 2" />
                <line x1={ox + W + 3} y1={ey + eh} x2={dimX - 3} y2={ey + eh} stroke={col} strokeWidth={0.7} strokeDasharray="3 2" />
                <Dim x1={dimX} y1={ey} x2={dimX} y2={ey + eh} label={`${hMm} mm`} color={col} />

                {/* Bottom from ground */}
                {yMm > 0 && (
                  <>
                    <line x1={ox + W + 3} y1={oy + H} x2={dimX + DIM_OFF - 3} y2={oy + H} stroke={col} strokeWidth={0.7} strokeDasharray="3 2" />
                    <Dim x1={dimX + DIM_OFF} y1={ey + eh} x2={dimX + DIM_OFF} y2={oy + H} label={`${yMm} mm`} color={col} />
                  </>
                )}

                {/* Distance from left wall edge */}
                {xMm > 10 && (
                  <>
                    <line x1={ox}      y1={oy + H + DIM_OFF * (placed.length + 1) + idx * DIM_OFF * 0.5} x2={ox}      y2={oy + H + DIM_OFF * (placed.length + 1) + idx * DIM_OFF * 0.5} stroke={col} strokeWidth={0} />
                    <Dim
                      x1={ox} y1={oy + H + DIM_OFF * (placed.length + 1) + idx * DIM_OFF * 0.7}
                      x2={ex} y2={oy + H + DIM_OFF * (placed.length + 1) + idx * DIM_OFF * 0.7}
                      label={`${Math.round(xMm)} mm`} color="#64748b"
                    />
                  </>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

export default function GarageMålAdmin({ widthMm, lengthMm, addedElements, roofType, buildingType, doorWidthMm, doorHeightMm }: Props) {
  if (buildingType === "carport") return (
    <div className="p-6 text-sm text-gray-400">Målsetting ikke tilgjengelig for carport.</div>
  );

  const hasAnything = addedElements.length > 0 || roofType === "flattak";

  return (
    <div className="p-4 sm:p-6 overflow-y-auto">
      <h2 className="text-base font-bold text-gray-900 mb-1">Målsetting — admin</h2>
      <p className="text-xs text-gray-500 mb-6">
        Posisjoner speiler nøyaktig plassering i 3D-modellen.
      </p>

      {WALL_ORDER.map((side) => {
        const wallMm  = (side === "left" || side === "right") ? lengthMm : widthMm;
        const els     = addedElements.filter((e) => e.side === side);
        const isFront = side === "front";
        return (
          <WallElevation
            key={side}
            wallMm={wallMm}
            wallLabel={SIDE_LABELS[side]}
            elements={els}
            isGarageFront={isFront}
            roofType={roofType}
            doorWidthMm={doorWidthMm}
            doorHeightMm={doorHeightMm}
          />
        );
      })}

      {!hasAnything && (
        <p className="text-sm text-gray-400 mt-4">Ingen dører, vinduer eller port lagt til ennå.</p>
      )}
    </div>
  );
}

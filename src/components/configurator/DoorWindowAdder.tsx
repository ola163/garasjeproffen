"use client";

import { useState } from "react";

export type WallSide = "front" | "back" | "left" | "right";
export type ElementCategory = "door" | "window1" | "window2";
export type Placement = "left" | "right" | "both";

export interface AddedElement {
  side: WallSide;
  category: ElementCategory;
  placement: Placement;
}

interface Props {
  onFocusSide: (side: WallSide | null) => void;
  onAdd: (el: AddedElement) => void;
  onClose: () => void;
}

const SIDE_LABELS: Record<WallSide, string> = {
  front: "Front",
  back: "Bak",
  left: "Venstre",
  right: "Høyre",
};

const CATEGORY_OPTIONS: { id: ElementCategory; label: string; description: string }[] = [
  { id: "door",    label: "Dør",       description: "0,9 × 2,1 m inngangsdør" },
  { id: "window1", label: "Vindu 1",   description: "1,0 × 0,8 m standard vindu" },
  { id: "window2", label: "Vindu 2",   description: "1,5 × 0,6 m bredformat vindu" },
];

const PLACEMENT_OPTIONS: { id: Placement; label: string }[] = [
  { id: "left",  label: "Venstre" },
  { id: "both",  label: "Begge" },
  { id: "right", label: "Høyre" },
];

export default function DoorWindowAdder({ onFocusSide, onAdd, onClose }: Props) {
  const [hoveredSide, setHoveredSide] = useState<WallSide | null>(null);
  const [selectedSide, setSelectedSide] = useState<WallSide | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<ElementCategory | null>(null);

  function handleSideClick(side: WallSide) {
    setSelectedSide(side);
    onFocusSide(side);
  }

  function handlePlacement(placement: Placement) {
    if (!selectedSide || !selectedCategory) return;
    onAdd({ side: selectedSide, category: selectedCategory, placement });
    onClose();
    onFocusSide(null);
  }

  function handleBack() {
    if (selectedCategory) {
      setSelectedCategory(null);
    } else {
      setSelectedSide(null);
      onFocusSide(null);
    }
  }

  const sideBtn = (side: WallSide, className: string) => (
    <button
      key={side}
      onMouseEnter={() => setHoveredSide(side)}
      onMouseLeave={() => setHoveredSide(null)}
      onClick={() => handleSideClick(side)}
      className={`${className} rounded px-2 py-1 text-xs font-medium transition-all border ${
        selectedSide === side
          ? "bg-orange-500 text-white border-orange-500"
          : hoveredSide === side
          ? "bg-orange-100 text-orange-700 border-orange-400"
          : "bg-white text-gray-600 border-gray-300 hover:border-orange-300"
      }`}
    >
      {SIDE_LABELS[side]}
    </button>
  );

  return (
    <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {(selectedSide || selectedCategory) && (
            <button onClick={handleBack} className="text-gray-400 hover:text-gray-600">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </button>
          )}
          <p className="text-xs font-semibold text-gray-700">
            {!selectedSide
              ? "Velg side på garasjen"
              : !selectedCategory
              ? `${SIDE_LABELS[selectedSide]} – velg type`
              : `Velg plassering`}
          </p>
        </div>
        <button onClick={() => { onClose(); onFocusSide(null); }} className="text-gray-400 hover:text-gray-600">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
      </div>

      {/* Step 1 — Side selector schematic */}
      {!selectedSide && (
        <div className="flex flex-col items-center gap-1 py-2">
          <p className="mb-2 text-xs text-orange-600 font-medium">Klikk på en side for å velge</p>
          {sideBtn("back", "")}
          <div className="flex items-center gap-1">
            {sideBtn("left", "")}
            <div className="w-20 h-14 rounded border-2 border-dashed border-gray-300 bg-white flex items-center justify-center">
              <span className="text-xs text-gray-400">Garasje</span>
            </div>
            {sideBtn("right", "")}
          </div>
          {sideBtn("front", "")}
        </div>
      )}

      {/* Step 2 — Category selector */}
      {selectedSide && !selectedCategory && (
        <div className="space-y-2">
          {CATEGORY_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => setSelectedCategory(opt.id)}
              className="flex w-full items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-left hover:border-orange-400 hover:bg-orange-50 transition-colors"
            >
              <div>
                <p className="text-sm font-medium text-gray-800">{opt.label}</p>
                <p className="text-xs text-gray-500">{opt.description}</p>
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            </button>
          ))}
        </div>
      )}

      {/* Step 3 — Placement selector */}
      {selectedSide && selectedCategory && (
        <div className="flex gap-2">
          {PLACEMENT_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => handlePlacement(opt.id)}
              className="flex-1 rounded-lg border border-gray-200 bg-white py-2.5 text-sm font-medium text-gray-700 hover:border-orange-500 hover:bg-orange-50 hover:text-orange-700 transition-colors"
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

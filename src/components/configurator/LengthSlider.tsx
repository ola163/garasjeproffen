"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as Slider from "@radix-ui/react-slider";

interface LengthSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (value: number) => void;
  debounceMs?: number;
}

export default function LengthSlider({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
  debounceMs = 500,
}: LengthSliderProps) {
  const [localValue, setLocalValue] = useState(value);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleChange = useCallback(
    (values: number[]) => {
      const newValue = values[0];
      setLocalValue(newValue);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => onChange(newValue), debounceMs);
    },
    [onChange, debounceMs]
  );

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const displayValue =
    unit === "mm" ? `${(localValue / 1000).toFixed(1)} m` : `${localValue} ${unit}`;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700">{label}</label>
        <span className="text-sm font-semibold text-[#e2520a]">{displayValue}</span>
      </div>

      <Slider.Root
        className="relative flex h-5 w-full touch-none select-none items-center"
        value={[localValue]}
        min={min}
        max={max}
        step={step}
        onValueChange={handleChange}
      >
        <Slider.Track className="relative h-2 w-full grow rounded-full bg-gray-200">
          <Slider.Range className="absolute h-full rounded-full bg-[#e2520a]" />
        </Slider.Track>
        <Slider.Thumb className="block h-5 w-5 rounded-full border-2 border-[#e2520a] bg-white shadow-md transition-colors hover:border-orange-700 focus:outline-none focus:ring-2 focus:ring-[#e2520a] focus:ring-offset-2" />
      </Slider.Root>

      <div className="flex justify-between text-xs text-gray-400">
        <span>{unit === "mm" ? `${min / 1000} m` : `${min} ${unit}`}</span>
        <span>{unit === "mm" ? `${max / 1000} m` : `${max} ${unit}`}</span>
      </div>
    </div>
  );
}

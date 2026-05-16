import type { GarageParameter } from "@/types/configurator";

export const GARAGE_PARAMETERS: GarageParameter[] = [
  {
    id: "length",
    label: "Lengde på garasje",
    unit: "mm",
    min: 4000,
    max: 10000,
    step: 100,
    defaultValue: 7800,
    type: "slider",
    group: "dimensions",
  },
  {
    id: "width",
    label: "Bredde på garasje",
    unit: "mm",
    min: 3000,
    max: 9000,
    step: 100,
    defaultValue: 6200,
    type: "slider",
    group: "dimensions",
  },
  {
    id: "doorWidth",
    label: "Bredde på garasjeport",
    unit: "mm",
    defaultValue: 2500,
    type: "select",
    group: "door",
    options: [
      { label: "2500 mm", value: 2500 },
      { label: "3000 mm", value: 3000 },
      { label: "5000 mm", value: 5000 },
    ],
  },
];

// Door height is always fixed — not a user choice
export const DOOR_HEIGHT_MM = 2125;

// Door color options (handled as string state, not a numeric GarageParameter)
export const DOOR_COLOR_OPTIONS = [
  { label: "Hvit", value: "hvit" },
  { label: "Sort", value: "sort" },
] as const;

export type DoorColor = "hvit" | "sort";

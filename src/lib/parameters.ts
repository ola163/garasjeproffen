import type { GarageParameter } from "@/types/configurator";

export const GARAGE_PARAMETERS: GarageParameter[] = [
  {
    id: "length",
    label: "Lengde på garasje",
    unit: "mm",
    min: 2400,
    max: 9000,
    step: 600,
    defaultValue: 6000,
    type: "slider",
    group: "dimensions",
  },
  {
    id: "width",
    label: "Bredde på garasje",
    unit: "mm",
    min: 2400,
    max: 9000,
    step: 600,
    defaultValue: 8400,
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
      { label: "2600 mm", value: 2600 },
      { label: "5000 mm", value: 5000 },
    ],
  },
  {
    id: "doorHeight",
    label: "Høyde på garasjeport",
    unit: "mm",
    defaultValue: 2125,
    type: "select",
    group: "door",
    options: [
      { label: "2125 mm", value: 2125 },
      { label: "2250 mm", value: 2250 },
    ],
  },
];

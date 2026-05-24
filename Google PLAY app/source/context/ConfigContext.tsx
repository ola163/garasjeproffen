import { createContext, useContext, useState, ReactNode } from "react";
import type { PackageType, RoofType, BuildingType } from "@/lib/pricing";

interface ConfigState {
  buildingType: BuildingType;
  packageType: PackageType;
  roofType: RoofType;
  widthMm: number;
  lengthMm: number;
  doorWidthMm: number;
  doorColor: string;
  totalPrice: number;
  manualQuote: boolean;
}

interface ConfigContextType {
  config: ConfigState;
  setConfig: (c: Partial<ConfigState>) => void;
}

const defaultConfig: ConfigState = {
  buildingType: "garasje",
  packageType: "materialpakke",
  roofType: "saltak",
  widthMm: 5000,
  lengthMm: 6000,
  doorWidthMm: 2500,
  doorColor: "hvit",
  totalPrice: 0,
  manualQuote: false,
};

const ConfigContext = createContext<ConfigContextType>({
  config: defaultConfig,
  setConfig: () => {},
});

export function ConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfigState] = useState<ConfigState>(defaultConfig);
  function setConfig(partial: Partial<ConfigState>) {
    setConfigState((prev) => ({ ...prev, ...partial }));
  }
  return (
    <ConfigContext.Provider value={{ config, setConfig }}>
      {children}
    </ConfigContext.Provider>
  );
}

export const useConfig = () => useContext(ConfigContext);

"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";

const GarageViewer = dynamic(() => import("@/components/configurator/GarageViewer"), { ssr: false });

export default function EmbedPage() {
  const [config, setConfig] = useState({
    widthMm: 5000,
    lengthMm: 6000,
    roofType: "flattak" as "flattak" | "saltak",
    doorWidthMm: 2500,
    doorHeightMm: 2125,
    buildingType: "garasje",
    doorColor: "hvit" as "hvit" | "sort",
  });

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    setConfig({
      widthMm:     Number(sp.get("width")      || 5000),
      lengthMm:    Number(sp.get("length")     || 6000),
      roofType:    (sp.get("roofType")         || "flattak") as "flattak" | "saltak",
      doorWidthMm: Number(sp.get("doorWidth")  || 2500),
      doorHeightMm:Number(sp.get("doorHeight") || 2125),
      buildingType: sp.get("buildingType")     || "garasje",
      doorColor:   (sp.get("doorColor")        || "hvit") as "hvit" | "sort",
    });

    // Native app sends updates via injectJavaScript calling this function
    (window as unknown as Record<string, unknown>).__updateGarage = (p: typeof config) => setConfig(c => ({ ...c, ...p }));
    return () => { delete (window as unknown as Record<string, unknown>).__updateGarage; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "#f5f5f4" }}>
      <GarageViewer
        widthMm={config.widthMm}
        lengthMm={config.lengthMm}
        roofType={config.roofType}
        doorWidthMm={config.doorWidthMm}
        doorHeightMm={config.doorHeightMm}
        buildingType={config.buildingType}
        doorColor={config.doorColor}
        addedElements={[]}
      />
    </div>
  );
}

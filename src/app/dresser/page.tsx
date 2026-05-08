"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import GarageMapbox from "@/components/configurator/GarageMapbox";

function DresserContent() {
  const params = useSearchParams();
  const [config, setConfig] = useState({
    widthMm:      Number(params.get("widthMm"))  || 5000,
    lengthMm:     Number(params.get("lengthMm")) || 6000,
    roofType:     (params.get("roofType") as "saltak" | "flattak") || "saltak",
    buildingType: (params.get("buildingType") as "garasje" | "carport") || "garasje",
  });

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      try {
        const data = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
        if (data?.type === "update") {
          setConfig((prev) => ({
            widthMm:      data.widthMm      ?? prev.widthMm,
            lengthMm:     data.lengthMm     ?? prev.lengthMm,
            roofType:     data.roofType     ?? prev.roofType,
            buildingType: data.buildingType ?? prev.buildingType,
          }));
        }
      } catch {
        // ignore
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999 }}>
      <GarageMapbox
        widthMm={config.widthMm}
        lengthMm={config.lengthMm}
        roofType={config.roofType}
        buildingType={config.buildingType}
        showNeighbors
        forceIs3D={false}
      />
    </div>
  );
}

export default function DresserPage() {
  return (
    <Suspense>
      <DresserContent />
    </Suspense>
  );
}

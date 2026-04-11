"use client";

import { useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { GarageConfiguration } from "@/types/configurator";
import { GARAGE_PARAMETERS } from "@/lib/parameters";

export function useConfigurator() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Build configuration from URL search params, falling back to defaults
  const configuration: GarageConfiguration = useMemo(() => {
    const parameters: Record<string, number> = {};

    for (const param of GARAGE_PARAMETERS) {
      const urlValue = searchParams.get(param.id);
      parameters[param.id] = urlValue ? Number(urlValue) : param.defaultValue;
    }

    return {
      parameters,
      timestamp: Date.now(),
    };
  }, [searchParams]);

  // Update a single parameter and sync to URL
  const setParameter = useCallback(
    (id: string, value: number) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set(id, String(value));
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  return {
    configuration,
    setParameter,
  };
}

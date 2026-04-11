"use client";

import { useState, useEffect, useRef, useCallback } from "react";

export type ModelStatus = "idle" | "loading" | "ready" | "error";

export function useGarageModel(parameters: Record<string, number>) {
  const [modelUrl, setModelUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<ModelStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchModel = useCallback(async (params: Record<string, number>) => {
    // Abort any previous request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setStatus("loading");
    setError(null);

    try {
      const res = await fetch("/api/model", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parameters: params }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Feil ${res.status}`);
      }

      const blob = await res.blob();
      // Revoke previous URL to avoid memory leaks
      if (modelUrl) URL.revokeObjectURL(modelUrl);

      const url = URL.createObjectURL(blob);
      setModelUrl(url);
      setStatus("ready");
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setStatus("error");
      setError(err instanceof Error ? err.message : "Ukjent feil");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced fetch when parameters change
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchModel(parameters);
    }, 800);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [parameters, fetchModel]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (modelUrl) URL.revokeObjectURL(modelUrl);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { modelUrl, status, error, isLoading: status === "loading" };
}

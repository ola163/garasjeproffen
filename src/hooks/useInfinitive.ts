"use client";

import { useState, useCallback } from "react";

type ModelStatus = "loading" | "ready" | "updating" | "error";

export function useInfinitive() {
  const [status, setStatus] = useState<ModelStatus>("loading");
  const [error, setError] = useState<string | null>(null);

  const onModelLoaded = useCallback(() => {
    setStatus("ready");
    setError(null);
  }, []);

  const onModelUpdating = useCallback(() => {
    setStatus("updating");
  }, []);

  const onModelUpdated = useCallback(() => {
    setStatus("ready");
    setError(null);
  }, []);

  const onError = useCallback((message: string) => {
    setStatus("error");
    setError(message);
  }, []);

  return {
    status,
    error,
    isLoading: status === "loading" || status === "updating",
    onModelLoaded,
    onModelUpdating,
    onModelUpdated,
    onError,
  };
}

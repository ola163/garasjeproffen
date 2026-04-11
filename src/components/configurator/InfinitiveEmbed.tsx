"use client";

import { useEffect, useRef, useCallback } from "react";

interface InfinitiveEmbedProps {
  projectId: string;
  embedUrl: string;
  parameters: Record<string, number>;
  onModelLoaded?: () => void;
  onModelUpdating?: () => void;
  onModelUpdated?: () => void;
  onError?: (error: string) => void;
}

export default function InfinitiveEmbed({
  projectId,
  embedUrl,
  parameters,
  onModelLoaded,
  onModelUpdating,
  onModelUpdated,
  onError,
}: InfinitiveEmbedProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const isReadyRef = useRef(false);

  // Listen for messages from the Infinitive iframe
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      // Only accept messages from the Infinitive embed origin
      if (!embedUrl || !event.origin.includes(new URL(embedUrl).hostname)) {
        return;
      }

      const { type, payload } = event.data || {};

      switch (type) {
        case "infinitive:ready":
          isReadyRef.current = true;
          onModelLoaded?.();
          break;
        case "infinitive:updating":
          onModelUpdating?.();
          break;
        case "infinitive:updated":
          onModelUpdated?.();
          break;
        case "infinitive:error":
          onError?.(payload?.message || "Unknown error");
          break;
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [embedUrl, onModelLoaded, onModelUpdating, onModelUpdated, onError]);

  // Send parameter updates to the Infinitive iframe
  const sendParameters = useCallback(
    (params: Record<string, number>) => {
      if (!iframeRef.current?.contentWindow || !isReadyRef.current) return;

      iframeRef.current.contentWindow.postMessage(
        {
          type: "infinitive:setParameters",
          payload: { parameters: params },
        },
        "*"
      );
    },
    []
  );

  // Update parameters when they change
  useEffect(() => {
    sendParameters(parameters);
  }, [parameters, sendParameters]);

  // Build the iframe URL with the project ID
  const iframeSrc = embedUrl
    ? `${embedUrl}?projectId=${encodeURIComponent(projectId)}`
    : "";

  if (!embedUrl) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50">
        <div className="text-center">
          <div className="text-4xl text-gray-300">3D</div>
          <p className="mt-2 text-sm text-gray-500">
            Infinitive.io 3D-visning
          </p>
          <p className="mt-1 text-xs text-gray-400">
            Sett opp NEXT_PUBLIC_INFINITIVE_EMBED_URL i .env.local
          </p>
        </div>
      </div>
    );
  }

  return (
    <iframe
      ref={iframeRef}
      src={iframeSrc}
      className="h-full w-full rounded-lg border-0"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope"
      sandbox="allow-scripts allow-same-origin allow-popups"
      title="3D Garasjekonfigurator"
    />
  );
}

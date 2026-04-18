"use client";

import { useState } from "react";
import Image from "next/image";
import type { ReferanseProject } from "@/types/referanse";

const CATEGORIES = [
  { id: "all", label: "Alle" },
  { id: "garasje-carport", label: "Garasje/Carport" },
  { id: "hagestue-bod", label: "Hagestue/Bod" },
  { id: "verksted", label: "Verksted" },
  { id: "pergola", label: "Frittliggende Pergola" },
  { id: "hytte-anneks", label: "Hytte/Anneks" },
];

const CATEGORY_COLORS: Record<string, string> = {
  "garasje-carport": "bg-orange-100 text-orange-700",
  "hagestue-bod": "bg-green-100 text-green-700",
  "verksted": "bg-blue-100 text-blue-700",
  "pergola": "bg-purple-100 text-purple-700",
  "hytte-anneks": "bg-amber-100 text-amber-700",
};

const CATEGORY_LABELS: Record<string, string> = {
  "garasje-carport": "Garasje/Carport",
  "hagestue-bod": "Hagestue/Bod",
  "verksted": "Verksted",
  "pergola": "Frittliggende Pergola",
  "hytte-anneks": "Hytte/Anneks",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("nb-NO", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

interface LightboxState {
  project: ReferanseProject;
  imageIndex: number;
}

export default function ReferanseGallery({ projects }: { projects: ReferanseProject[] }) {
  const [activeCategory, setActiveCategory] = useState("all");
  const [lightbox, setLightbox] = useState<LightboxState | null>(null);

  const filtered =
    activeCategory === "all"
      ? projects
      : projects.filter((p) => p.category === activeCategory);

  function openLightbox(project: ReferanseProject, imageIndex = 0) {
    setLightbox({ project, imageIndex });
  }

  function moveLightbox(dir: 1 | -1) {
    setLightbox((prev) => {
      if (!prev) return null;
      const len = prev.project.images.length;
      return { ...prev, imageIndex: (prev.imageIndex + dir + len) % len };
    });
  }

  return (
    <>
      {/* Category filter pills */}
      <div className="mb-8 flex flex-wrap justify-center gap-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
              activeCategory === cat.id
                ? "bg-orange-500 text-white shadow-sm"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="py-24 text-center">
          <p className="text-gray-400">Ingen prosjekter ennå i denne kategorien.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((project) => {
            const cover = project.images?.[0];
            return (
              <article
                key={project.id}
                onClick={() => openLightbox(project)}
                className="group cursor-pointer overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="relative aspect-[4/3] bg-gray-100">
                  {cover ? (
                    <Image
                      src={cover}
                      alt={project.title}
                      fill
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <svg className="h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                  {project.images?.length > 1 && (
                    <div className="absolute bottom-2 right-2 rounded-md bg-black/50 px-2 py-0.5 text-xs text-white">
                      {project.images.length} bilder
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        CATEGORY_COLORS[project.category] ?? "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {CATEGORY_LABELS[project.category] ?? project.category}
                    </span>
                    <span className="shrink-0 text-xs text-gray-400">{formatDate(project.created_at)}</span>
                  </div>
                  <h2 className="text-base font-semibold text-gray-900 transition-colors group-hover:text-orange-600">
                    {project.title}
                  </h2>
                  {project.description && (
                    <p className="mt-1 line-clamp-3 text-sm text-gray-500">{project.description}</p>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setLightbox(null)}
        >
          <div
            className="relative w-full max-w-4xl overflow-hidden rounded-xl bg-white"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close */}
            <button
              onClick={() => setLightbox(null)}
              className="absolute right-3 top-3 z-10 rounded-full bg-black/50 p-1.5 text-white hover:bg-black/70"
            >
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>

            {/* Image viewer */}
            {lightbox.project.images?.length > 0 && (
              <div className="relative aspect-video bg-gray-900">
                <Image
                  src={lightbox.project.images[lightbox.imageIndex]}
                  alt={lightbox.project.title}
                  fill
                  className="object-contain"
                  sizes="100vw"
                />

                {lightbox.project.images.length > 1 && (
                  <>
                    <button
                      onClick={() => moveLightbox(-1)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white hover:bg-black/70"
                    >
                      <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </button>
                    <button
                      onClick={() => moveLightbox(1)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white hover:bg-black/70"
                    >
                      <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                      </svg>
                    </button>

                    {/* Dot indicators */}
                    <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
                      {lightbox.project.images.map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setLightbox((prev) => prev ? { ...prev, imageIndex: i } : null)}
                          className={`h-1.5 rounded-full transition-all ${
                            i === lightbox.imageIndex ? "w-4 bg-white" : "w-1.5 bg-white/50"
                          }`}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Project info */}
            <div className="p-5">
              <div className="mb-2 flex items-start justify-between gap-3">
                <span
                  className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    CATEGORY_COLORS[lightbox.project.category] ?? "bg-gray-100 text-gray-600"
                  }`}
                >
                  {CATEGORY_LABELS[lightbox.project.category] ?? lightbox.project.category}
                </span>
                <span className="text-xs text-gray-400">{formatDate(lightbox.project.created_at)}</span>
              </div>
              <h2 className="text-lg font-bold text-gray-900">{lightbox.project.title}</h2>
              {lightbox.project.description && (
                <p className="mt-2 whitespace-pre-line text-sm text-gray-600">{lightbox.project.description}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

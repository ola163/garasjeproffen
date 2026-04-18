"use client";

import { useState } from "react";
import Image from "next/image";

interface FacebookPhoto {
  id: string;
  caption: string;
  createdTime: string;
  src: string;
  thumb: string;
}

interface Props {
  photos: FacebookPhoto[];
}

export default function FacebookFeed({ photos }: Props) {
  const [lightbox, setLightbox] = useState<number | null>(null);

  if (photos.length === 0) return null;

  return (
    <section className="mt-16 border-t border-gray-100 pt-12">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1877F2]">
            <svg className="h-5 w-5 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.791-4.697 4.533-4.697 1.312 0 2.686.235 2.686.235v2.97h-1.513c-1.491 0-1.956.93-1.956 1.886v2.269h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/>
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Fra Facebook</h2>
            <a
              href="https://www.facebook.com/garasjeproffen"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-[#1877F2] hover:underline"
            >
              Følg oss på Facebook →
            </a>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {photos.map((photo, i) => (
          <button
            key={photo.id}
            onClick={() => setLightbox(i)}
            className="group relative aspect-square overflow-hidden rounded-xl bg-gray-100"
          >
            <Image
              src={photo.thumb || photo.src}
              alt={photo.caption || "Facebook bilde"}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
            />
            {photo.caption && (
              <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/50 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
                <p className="line-clamp-2 text-xs text-white">{photo.caption}</p>
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Lightbox */}
      {lightbox !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            onClick={(e) => { e.stopPropagation(); setLightbox((l) => (l! > 0 ? l! - 1 : photos.length - 1)); }}
            className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/20 p-3 text-white hover:bg-white/40"
          >
            ‹
          </button>
          <div className="relative max-h-[85vh] max-w-4xl w-full" onClick={(e) => e.stopPropagation()}>
            <Image
              src={photos[lightbox].src}
              alt={photos[lightbox].caption || "Facebook bilde"}
              width={1200}
              height={900}
              className="max-h-[85vh] w-full rounded-xl object-contain"
            />
            {photos[lightbox].caption && (
              <p className="mt-3 text-center text-sm text-white/80">{photos[lightbox].caption}</p>
            )}
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); setLightbox((l) => (l! < photos.length - 1 ? l! + 1 : 0)); }}
            className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/20 p-3 text-white hover:bg-white/40"
          >
            ›
          </button>
          <button
            onClick={() => setLightbox(null)}
            className="absolute right-4 top-4 rounded-full bg-white/20 p-2 text-white hover:bg-white/40"
          >
            ✕
          </button>
        </div>
      )}
    </section>
  );
}

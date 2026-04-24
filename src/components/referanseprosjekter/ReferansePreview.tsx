"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import type { ReferanseProject } from "@/types/referanse";

export default function ReferansePreview() {
  const [projects, setProjects] = useState<ReferanseProject[]>([]);

  useEffect(() => {
    if (!supabase) return;
    supabase
      .from("reference_projects")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(3)
      .then(({ data }) => { if (data) setProjects(data as ReferanseProject[]); });
  }, []);

  if (projects.length === 0) return null;

  return (
    <section className="w-full max-w-2xl px-6 pb-12">
      <Link href="/referanseprosjekter" className="mb-1 block text-xs font-medium text-orange-500 hover:underline">
        Se alle →
      </Link>
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-400">Referanseprosjekter</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {projects.map((p) => (
          <Link
            key={p.id}
            href="/referanseprosjekter"
            className="group overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="relative aspect-video w-full overflow-hidden bg-gray-100">
              {p.images?.[0] ? (
                <Image
                  src={p.images[0]}
                  alt={p.title}
                  fill
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                  sizes="(max-width: 640px) 100vw, 33vw"
                />
              ) : (
                <div className="flex h-full items-center justify-center bg-gray-200">
                  <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              )}
            </div>
            <div className="p-3">
              <p className="text-sm font-semibold text-gray-900 line-clamp-1 group-hover:text-orange-500">{p.title}</p>
              {p.description && (
                <p className="mt-1 text-xs text-gray-500 line-clamp-2">{p.description}</p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";
import type { ReferanseProject } from "@/types/referanse";
import Image from "next/image";

const ALLOWED_ADMINS = ["ola@garasjeproffen.no", "christian@garasjeproffen.no"];

const CATEGORIES = [
  { id: "garasje-carport", label: "Garasje/Carport" },
  { id: "hagestue-bod", label: "Hagestue/Bod" },
  { id: "verksted", label: "Verksted" },
  { id: "pergola", label: "Frittliggende Pergola" },
  { id: "hytte-anneks", label: "Hytte/Anneks" },
];

const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, c.label])
);

export default function AdminReferanseprosjekter() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Login form
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  // Create form
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("garasje-carport");
  const [description, setDescription] = useState("");
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ success: boolean; message: string } | null>(null);

  // Projects list
  const [projects, setProjects] = useState<ReferanseProject[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!supabase) { setAuthLoading(false); return; }
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setAuthLoading(false);
      if (data.user) loadProjects();
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
      if (session?.user) loadProjects();
    });
    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadProjects() {
    if (!supabase) return;
    setLoadingProjects(true);
    const { data } = await supabase
      .from("reference_projects")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setProjects(data as ReferanseProject[]);
    setLoadingProjects(false);
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setLoginLoading(true); setLoginError("");
    const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password: loginPassword });
    setLoginLoading(false);
    if (error) setLoginError("Feil e-post eller passord.");
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    setImageFiles((prev) => [...prev, ...files]);
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => setImagePreviews((prev) => [...prev, ev.target?.result as string]);
      reader.readAsDataURL(file);
    });
    // Reset input so same files can be re-selected
    if (e.target) e.target.value = "";
  }

  function removeImage(index: number) {
    setImageFiles((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || !user) return;
    setSubmitting(true); setSubmitResult(null);

    try {
      // 1. Upload images to Supabase Storage
      const uploadedUrls: string[] = [];
      for (const file of imageFiles) {
        const ext = file.name.split(".").pop() ?? "jpg";
        const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("reference-images")
          .upload(path, file, { contentType: file.type });

        if (uploadError) throw new Error(`Bildeopplasting feilet: ${uploadError.message}`);

        const { data: urlData } = supabase.storage
          .from("reference-images")
          .getPublicUrl(path);
        uploadedUrls.push(urlData.publicUrl);
      }

      // 2. Insert project into DB
      const { error: insertError } = await supabase.from("reference_projects").insert({
        title,
        category,
        description,
        images: uploadedUrls,
        created_by: user.email,
      });

      if (insertError) throw new Error(insertError.message);

      // 3. Post to Facebook (best-effort – errors don't fail the whole publish)
      const fbRes = await fetch("/api/referanseprosjekter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, category, description, images: uploadedUrls, userEmail: user.email }),
      });
      const fbData = await fbRes.json();
      const fbNote = fbData.facebookPostId
        ? " Delt på Facebook."
        : "";

      // 4. Reset form
      setTitle(""); setCategory("garasje-carport"); setDescription("");
      setImageFiles([]); setImagePreviews([]);
      if (fileInputRef.current) fileInputRef.current.value = "";

      setSubmitResult({ success: true, message: `Prosjekt publisert!${fbNote}` });
      loadProjects();
    } catch (err) {
      setSubmitResult({
        success: false,
        message: err instanceof Error ? err.message : "Noe gikk galt.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!supabase || !confirm("Vil du slette dette prosjektet?")) return;
    await supabase.from("reference_projects").delete().eq("id", id);
    setProjects((prev) => prev.filter((p) => p.id !== id));
  }

  // ── Loading ──
  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-gray-400">Laster...</div>
      </div>
    );
  }

  if (!supabase) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">Supabase er ikke konfigurert.</p>
      </div>
    );
  }

  // ── Not logged in ──
  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
          <h1 className="mb-1 text-xl font-bold text-gray-900">Admin – Referanseprosjekter</h1>
          <p className="mb-6 text-sm text-gray-500">Logg inn med din GarasjeProffen-konto.</p>
          <form onSubmit={handleLogin} className="space-y-3">
            <input
              type="email"
              required
              placeholder="E-post"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
            <input
              type="password"
              required
              placeholder="Passord"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
            {loginError && <p className="text-xs text-red-500">{loginError}</p>}
            <button
              type="submit"
              disabled={loginLoading}
              className="w-full rounded-lg bg-orange-500 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50"
            >
              {loginLoading ? "Logger inn…" : "Logg inn"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── Wrong email ──
  if (!ALLOWED_ADMINS.includes(user.email?.toLowerCase() ?? "")) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="text-center">
          <p className="text-gray-600">Du har ikke tilgang til admin-panelet.</p>
          <p className="mt-1 text-sm text-gray-400">{user.email}</p>
          <button
            onClick={() => supabase?.auth.signOut()}
            className="mt-4 text-sm text-orange-500 hover:underline"
          >
            Logg ut
          </button>
        </div>
      </div>
    );
  }

  // ── Admin interface ──
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Referanseprosjekter</h1>
            <p className="mt-0.5 text-sm text-gray-400">{user.email}</p>
          </div>
          <div className="flex items-center gap-4">
            <a href="/referanseprosjekter" className="text-sm text-gray-500 underline hover:text-gray-700">
              Se siden
            </a>
            <button
              onClick={() => supabase?.auth.signOut()}
              className="text-sm text-gray-400 hover:text-gray-600"
            >
              Logg ut
            </button>
          </div>
        </div>

        {/* Create form */}
        <div className="mb-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-5 text-lg font-semibold text-gray-900">Legg til nytt prosjekt</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Title */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Tittel *</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="F.eks. Dobbeltgarasje med saltak i Stavanger"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>

            {/* Category */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Kategori *</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.label}</option>
                ))}
              </select>
            </div>

            {/* Description */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Beskrivelse</label>
              <textarea
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Beskriv prosjektet – hva ble bygget, for hvem, eventuelle spesialdetaljer..."
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>

            {/* Image upload */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Bilder</label>
              <div
                onClick={() => fileInputRef.current?.click()}
                className="cursor-pointer rounded-xl border-2 border-dashed border-gray-300 p-6 text-center transition-colors hover:border-orange-400"
              >
                <svg className="mx-auto mb-2 h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-sm text-gray-500">Klikk for å velge bilder</p>
                <p className="mt-1 text-xs text-gray-400">JPG, PNG, WEBP – du kan velge flere</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileChange}
                className="hidden"
              />

              {imagePreviews.length > 0 && (
                <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
                  {imagePreviews.map((src, i) => (
                    <div key={i} className="group relative aspect-square overflow-hidden rounded-lg border border-gray-200">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt="" className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeImage(i)}
                        className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100"
                      >
                        <svg className="h-6 w-6 text-white" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {submitResult && (
              <div
                className={`rounded-lg border p-3 text-sm ${
                  submitResult.success
                    ? "border-green-200 bg-green-50 text-green-700"
                    : "border-red-200 bg-red-50 text-red-700"
                }`}
              >
                {submitResult.message}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || !title}
              className="w-full rounded-lg bg-orange-500 py-2.5 text-sm font-medium text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "Publiserer…" : "Publiser prosjekt"}
            </button>
          </form>
        </div>

        {/* Published projects */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            Publiserte prosjekter ({projects.length})
          </h2>
          {loadingProjects ? (
            <p className="text-sm text-gray-400">Laster...</p>
          ) : projects.length === 0 ? (
            <p className="text-sm text-gray-400">Ingen prosjekter ennå.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {projects.map((p) => (
                <li key={p.id} className="flex items-center gap-4 py-3">
                  {p.images?.[0] && (
                    <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                      <Image src={p.images[0]} alt="" fill className="object-cover" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-gray-900">{p.title}</p>
                    <p className="mt-0.5 text-xs text-gray-400">
                      {CATEGORY_LABELS[p.category] ?? p.category}
                      {" · "}
                      {p.images?.length ?? 0} bilder
                      {" · "}
                      {new Date(p.created_at).toLocaleDateString("nb-NO")}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDelete(p.id)}
                    className="shrink-0 rounded-lg border border-red-200 px-3 py-1.5 text-xs text-red-500 hover:bg-red-50"
                  >
                    Slett
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

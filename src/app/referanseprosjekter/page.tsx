import { createClient } from "@supabase/supabase-js";
import ReferanseGallery from "@/components/referanseprosjekter/ReferanseGallery";
import FacebookFeed from "@/components/referanseprosjekter/FacebookFeed";
import type { ReferanseProject } from "@/types/referanse";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Referanseprosjekter | Garasjer og carporter på Jæren | GarasjeProffen",
  description: "Se referanseprosjekter fra GarasjeProffen. Vi leverer garasjer, carporter, uthus, materialpakker og prefabrikkerte løsninger på Jæren og i Rogaland.",
  alternates: { canonical: "https://www.garasjeproffen.no/referanseprosjekter" },
  openGraph: {
    title: "Referanseprosjekter | Garasjer og carporter på Jæren | GarasjeProffen",
    description: "Se referanseprosjekter fra GarasjeProffen. Vi leverer garasjer, carporter, uthus, materialpakker og prefabrikkerte løsninger på Jæren og i Rogaland.",
    url: "https://www.garasjeproffen.no/referanseprosjekter",
    images: [{ url: "/logo.jpg", width: 600, height: 600, alt: "GarasjeProffen AS" }],
  },
};

async function getProjects(): Promise<ReferanseProject[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return [];

  const supabase = createClient(url, key);
  const { data, error } = await supabase
    .from("reference_projects")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching reference projects:", error);
    return [];
  }

  return data as ReferanseProject[];
}

async function getFacebookPhotos() {
  const pageId = process.env.FB_PAGE_ID;
  const token = process.env.FB_PAGE_ACCESS_TOKEN;
  if (!pageId || !token) return [];

  try {
    const res = await fetch(
      `https://graph.facebook.com/v20.0/${pageId}/photos?type=uploaded&fields=images,name,created_time&limit=12&access_token=${token}`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.data ?? []).map((p: {
      id: string;
      name?: string;
      created_time: string;
      images: { source: string; height: number; width: number }[];
    }) => ({
      id: p.id,
      caption: p.name ?? "",
      createdTime: p.created_time,
      src: p.images?.[0]?.source ?? "",
      thumb: p.images?.find((img: { width: number }) => img.width <= 720)?.source ?? p.images?.[0]?.source ?? "",
    }));
  } catch {
    return [];
  }
}

export default async function ReferanseprosjekterPage() {
  const [projects, facebookPhotos] = await Promise.all([getProjects(), getFacebookPhotos()]);

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Våre referanseprosjekter
          </h1>
          <p className="mt-3 text-base text-gray-500">
            Her finner du et utvalg av garasjer, carporter og uthus vi har levert til fornøyde kunder på Jæren og i Rogaland. Prosjektene spenner fra enkle materialpakker til skreddersydde prefabrikkerte løsninger – med og uten søknadshjelp.
          </p>
        </div>

        <ReferanseGallery projects={projects} />

        {projects.length === 0 && (
          <div className="py-16 text-center">
            <p className="text-gray-400">Ingen prosjekter er publisert ennå. Sjekk tilbake snart!</p>
          </div>
        )}

        <FacebookFeed photos={facebookPhotos} />
      </div>
    </main>
  );
}

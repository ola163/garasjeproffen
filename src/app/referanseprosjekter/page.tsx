import { createClient } from "@supabase/supabase-js";
import ReferanseGallery from "@/components/referanseprosjekter/ReferanseGallery";
import type { ReferanseProject } from "@/types/referanse";

export const dynamic = "force-dynamic";

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

export default async function ReferanseprosjekterPage() {
  const projects = await getProjects();

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Våre referanseprosjekter
          </h1>
          <p className="mt-3 text-base text-gray-500">
            Se hva vi har bygget for fornøyde kunder rundt om i landet.{" "}
            <a
              href="https://www.facebook.com/garasjeproffen"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-orange-500 hover:underline"
            >
              Følg oss på Facebook
            </a>{" "}
            for oppdateringer.
          </p>
        </div>

        <ReferanseGallery projects={projects} />

        {projects.length === 0 && (
          <div className="py-24 text-center">
            <p className="text-gray-400">Ingen prosjekter er publisert ennå. Sjekk tilbake snart!</p>
          </div>
        )}
      </div>
    </main>
  );
}

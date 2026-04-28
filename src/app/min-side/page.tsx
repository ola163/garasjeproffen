import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import EmailLogin from "@/components/auth/EmailLogin";
import ProfileEditor from "@/components/auth/ProfileEditor";

const STATUS_LABELS: Record<string, string> = {
  new: "Ny",
  in_review: "Under behandling",
  pending_approval: "Venter godkjenning",
  offer_sent: "Tilbud sendt",
  paid: "Betalt",
  cancelled: "Kansellert",
};

const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-100 text-blue-700",
  in_review: "bg-yellow-100 text-yellow-700",
  pending_approval: "bg-orange-100 text-orange-700",
  offer_sent: "bg-purple-100 text-purple-700",
  paid: "bg-green-100 text-green-700",
  cancelled: "bg-gray-100 text-gray-500",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("nb-NO", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });
}

export default async function MinSidePage({ searchParams: _searchParams }: { searchParams: Promise<unknown> }) {
  const cookieStore = await cookies();
  const email = cookieStore.get("gp-user")?.value ?? "";
  const isAdmin = cookieStore.get("gp-admin")?.value === "1";
  const isLoggedIn = !!email;

  const session = { email, name: email, isLoggedIn, isAdmin };

  // Not logged in — show login page
  if (!session.isLoggedIn) {
    return (
      <div className="flex min-h-[calc(100vh-8rem)] flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-100">
            <svg className="h-8 w-8 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Min side</h1>
          <p className="mt-3 text-sm text-gray-500">
            Logg inn for å se dine tilbudsforespørsler og administrere din profil.
          </p>

          <div className="mt-6 text-left">
            <EmailLogin />
          </div>

          <div className="mt-8 border-t border-gray-100 pt-6">
            <p className="text-xs text-gray-400">Har du ikke sendt en forespørsel ennå?</p>
            <Link href="/" className="mt-2 block text-sm font-medium text-orange-500 hover:underline">
              Design din garasje →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Fetch quotes by email if available
  let quotes: Array<{
    id: string;
    ticket_number: string;
    status: string;
    created_at: string;
    customer_name: string;
    configuration: unknown;
    package_type: string | null;
  }> = [];

  if (session.email) {
    const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (sbUrl && sbKey) {
      const sb = createClient(sbUrl, sbKey);
      const { data } = await sb
        .from("quotes")
        .select("id, ticket_number, status, created_at, customer_name, configuration, package_type")
        .eq("customer_email", session.email)
        .order("created_at", { ascending: false });
      if (data) quotes = data;
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500">Innlogget</p>
          <h1 className="mt-0.5 text-2xl font-bold text-gray-900">{session.name}</h1>
          {session.email && <p className="mt-0.5 text-sm text-gray-400">{session.email}</p>}
        </div>
        <a
          href="/api/auth/logout"
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-50"
        >
          Logg ut
        </a>
      </div>

      {/* Admin shortcut */}
      {session.isAdmin && (
        <a
          href="/admin"
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Adminpanel
        </a>
      )}

      {/* Orders */}
      <div className="mt-10">
        <h2 className="text-lg font-semibold text-gray-900">Dine forespørsler</h2>

        {!session.email ? (
          <div className="mt-4 rounded-xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center">
            <p className="text-sm text-gray-500">
              Vi finner ingen forespørsler knyttet til denne kontoen. Kontakt oss på{" "}
              <a href="mailto:post@garasjeproffen.no" className="text-orange-500 hover:underline">
                post@garasjeproffen.no
              </a>{" "}
              hvis du tror noe mangler.
            </p>
          </div>
        ) : quotes.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center">
            <p className="text-sm text-gray-500">Du har ingen forespørsler ennå.</p>
            <Link href="/" className="mt-3 inline-block text-sm font-medium text-orange-500 hover:underline">
              Start en ny forespørsel →
            </Link>
          </div>
        ) : (
          <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs font-medium uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left">Ticket</th>
                  <th className="hidden px-4 py-3 text-left sm:table-cell">Type</th>
                  <th className="hidden px-4 py-3 text-left md:table-cell">Dato</th>
                  <th className="px-4 py-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {quotes.map((q) => {
                  const p = (q.configuration as { parameters?: Record<string, number> } | null)?.parameters;
                  return (
                    <tr key={q.id}>
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs font-semibold text-gray-700">{q.ticket_number}</span>
                      </td>
                      <td className="hidden px-4 py-3 text-xs text-gray-500 sm:table-cell">
                        {p ? `${(p.width ?? 0) / 1000} × ${(p.length ?? 0) / 1000} m` : "–"}
                        {q.package_type && <span className="ml-1 text-gray-400">· {q.package_type === "prefab" ? "Prefab" : "Materialpakke"}</span>}
                      </td>
                      <td className="hidden px-4 py-3 text-xs text-gray-400 md:table-cell">{formatDate(q.created_at)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[q.status] ?? "bg-gray-100 text-gray-500"}`}>
                          {STATUS_LABELS[q.status] ?? q.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Profile section */}
      <div className="mt-10 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Din profil</h2>
        <p className="mt-1 text-sm text-gray-400">Administrer kontaktinformasjonen din.</p>
        <ProfileEditor isAdmin={isAdmin} />
      </div>

      <div className="mt-8 text-center">
        <p className="text-xs text-gray-400">
          Spørsmål? Kontakt oss på{" "}
          <a href="mailto:post@garasjeproffen.no" className="text-orange-500 hover:underline">
            post@garasjeproffen.no
          </a>
        </p>
      </div>
    </div>
  );
}

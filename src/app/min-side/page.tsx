import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { createClient } from "@supabase/supabase-js";
import { sessionOptions, type CustomerSession } from "@/lib/session";
import Link from "next/link";

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

interface SearchParams {
  error?: string;
}

export default async function MinSidePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const [cookieStore, resolvedParams] = await Promise.all([cookies(), searchParams]);
  const error = resolvedParams?.error;

  let session: CustomerSession = { sub: "", name: "", isLoggedIn: false };
  try {
    session = await getIronSession<CustomerSession>(cookieStore, sessionOptions);
  } catch (err) {
    console.error("Session error:", err);
  }

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
            Logg inn med BankID for å se dine tilbudsforespørsler og administrere din profil.
          </p>

          {error && (
            <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
              {error === "auth_failed" && "Innlogging feilet. Prøv igjen."}
              {error === "invalid_state" && "Ugyldig forespørsel. Prøv igjen."}
              {error === "access_denied" && "Innlogging ble avbrutt."}
              {!["auth_failed", "invalid_state", "access_denied"].includes(error) && "Noe gikk galt. Prøv igjen."}
            </div>
          )}

          <a
            href="/api/auth/login"
            className="mt-6 flex w-full items-center justify-center gap-3 rounded-xl bg-[#1b4f9c] px-6 py-3.5 text-sm font-semibold text-white hover:bg-[#163f7d] transition-colors"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/>
            </svg>
            Logg inn med BankID
          </a>

          <p className="mt-4 text-xs text-gray-400">
            Sikker innlogging via Signicat / BankID
          </p>

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
    const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
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
          <p className="text-sm text-gray-500">Innlogget med BankID</p>
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

      {/* Verified badge */}
      <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700">
        <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
        Verifisert med BankID
      </div>

      {/* Orders */}
      <div className="mt-10">
        <h2 className="text-lg font-semibold text-gray-900">Dine forespørsler</h2>

        {!session.email ? (
          <div className="mt-4 rounded-xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center">
            <p className="text-sm text-gray-500">
              Vi kunne ikke hente e-postadressen din fra BankID. Kontakt oss på{" "}
              <a href="mailto:post@garasjeproffen.no" className="text-orange-500 hover:underline">
                post@garasjeproffen.no
              </a>{" "}
              for å koble forespørslene til din konto.
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
        <p className="mt-1 text-sm text-gray-400">Informasjonen er hentet fra BankID og er verifisert.</p>
        <dl className="mt-4 space-y-3 text-sm">
          <div className="flex gap-4">
            <dt className="w-24 shrink-0 font-medium text-gray-500">Navn</dt>
            <dd className="text-gray-900">{session.name}</dd>
          </div>
          {session.email && (
            <div className="flex gap-4">
              <dt className="w-24 shrink-0 font-medium text-gray-500">E-post</dt>
              <dd className="text-gray-900">{session.email}</dd>
            </div>
          )}
        </dl>
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

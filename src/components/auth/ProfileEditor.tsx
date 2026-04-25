"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { getFirebaseAuth } from "@/lib/firebase";
import type { ConfirmationResult } from "firebase/auth";

type Msg = { type: "success" | "error" | "info"; text: string };

type ChangeLog = {
  id: string;
  change_type: string;
  old_value: string | null;
  new_value: string | null;
  status: string;
  changed_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  note: string | null;
};

type UserProfile = {
  phone: string | null;
  phone_verified_at: string | null;
  address: string | null;
  address_pending: string | null;
};

const TYPE_LABELS: Record<string, string> = {
  name: "Navn", email: "E-post", phone: "Telefon", address: "Adresse",
};
const STATUS_STYLES: Record<string, string> = {
  completed:        "bg-green-100 text-green-700",
  pending_approval: "bg-yellow-100 text-yellow-700",
  approved:         "bg-green-100 text-green-700",
  rejected:         "bg-red-100 text-red-600",
};
const STATUS_LABELS: Record<string, string> = {
  completed:        "Fullført",
  pending_approval: "Venter godkjenning",
  approved:         "Godkjent",
  rejected:         "Avvist",
};

function formatDt(iso: string) {
  return new Date(iso).toLocaleString("nb-NO", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

async function getBearerToken(): Promise<string | null> {
  if (!supabase) return null;
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

// ── Profile (name + email) ───────────────────────────────────────────────────
function ProfileSection({ onLogged }: { onLogged: () => void }) {
  const [originalName,  setOriginalName]  = useState("");
  const [originalEmail, setOriginalEmail] = useState("");
  const [name,  setName]  = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [msg, setMsg] = useState<Msg | null>(null);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        const n = user.user_metadata?.full_name ?? "";
        const e = user.email ?? "";
        setOriginalName(n); setOriginalEmail(e);
        setName(n); setEmail(e);
        setHasSession(true);
      }
      setLoading(false);
    });
  }, []);

  async function handleSave(e: React.SyntheticEvent) {
    e.preventDefault();
    if (!supabase) return;
    setSaving(true); setMsg(null);
    const nameChanged  = name.trim() !== originalName;
    const emailChanged = email.trim().toLowerCase() !== originalEmail.toLowerCase();
    if (!nameChanged && !emailChanged) { setMsg({ type: "info", text: "Ingen endringer." }); setSaving(false); return; }
    const update: Parameters<typeof supabase.auth.updateUser>[0] = {};
    if (nameChanged)  update.data  = { full_name: name.trim() };
    if (emailChanged) update.email = email.trim();
    const { error } = await supabase.auth.updateUser(update);
    if (error) { setMsg({ type: "error", text: error.message }); }
    else if (emailChanged) { setMsg({ type: "info", text: "Bekreftelseslenke sendt til ny e-postadresse." }); if (nameChanged) setOriginalName(name.trim()); }
    else { setOriginalName(name.trim()); setMsg({ type: "success", text: "Lagret." }); onLogged(); }
    setSaving(false);
  }

  if (loading) return <div className="h-24 animate-pulse rounded-lg bg-gray-100" />;
  if (!hasSession) return <p className="text-sm text-gray-400">Logg inn med e-post og passord for å redigere profilen.</p>;

  return (
    <form onSubmit={handleSave} className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Navn</label>
        <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Ditt navn"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">E-post</label>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400" />
        {email.trim().toLowerCase() !== originalEmail.toLowerCase() && (
          <p className="mt-1 text-xs text-amber-600">Du vil motta en bekreftelseslenke på den nye adressen.</p>
        )}
      </div>
      {msg && <div className={`rounded-lg px-3 py-2 text-sm ${msg.type === "success" ? "bg-green-50 text-green-700" : msg.type === "error" ? "bg-red-50 text-red-700" : "bg-blue-50 text-blue-700"}`}>{msg.text}</div>}
      <button type="submit" disabled={saving} className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50 transition-colors">
        {saving ? "Lagrer…" : "Lagre"}
      </button>
    </form>
  );
}

// ── Phone ────────────────────────────────────────────────────────────────────
function PhoneSection({ profile, onSaved }: { profile: UserProfile | null; onSaved: () => void }) {
  const [newPhone, setNewPhone] = useState("");
  const [otpSent,  setOtpSent]  = useState(false);
  const [otp,      setOtp]      = useState("");
  const [sending,  setSending]  = useState(false);
  const [verifying,setVerifying]= useState(false);
  const [saving,   setSaving]   = useState(false);
  const [msg, setMsg] = useState<Msg | null>(null);
  const confirmRef   = useRef<ConfirmationResult | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recaptchaRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  async function sendOtp() {
    if (!newPhone.trim()) { setMsg({ type: "error", text: "Skriv inn nytt telefonnummer." }); return; }
    setMsg(null); setSending(true);
    try {
      const auth = await getFirebaseAuth();
      if (!auth) throw new Error("Firebase utilgjengelig");
      const { RecaptchaVerifier, signInWithPhoneNumber } = await import("firebase/auth");
      if (!recaptchaRef.current) {
        recaptchaRef.current = new RecaptchaVerifier(auth, containerRef.current!, { size: "invisible" });
      }
      const formatted = newPhone.startsWith("+") ? newPhone : `+47${newPhone.replace(/\s/g, "")}`;
      confirmRef.current = await signInWithPhoneNumber(auth, formatted, recaptchaRef.current);
      setOtpSent(true);
      setMsg({ type: "info", text: "Kode sendt via SMS." });
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code ?? (err as Error)?.message ?? "ukjent feil";
      setMsg({ type: "error", text: `Kunne ikke sende SMS: ${code}` });
      recaptchaRef.current?.clear(); recaptchaRef.current = null;
    } finally { setSending(false); }
  }

  async function verifyAndSave() {
    if (!otp || !confirmRef.current) return;
    setMsg(null); setVerifying(true);
    try {
      await confirmRef.current.confirm(otp);
    } catch { setMsg({ type: "error", text: "Feil kode. Prøv igjen." }); setVerifying(false); return; }
    setVerifying(false); setSaving(true);
    try {
      const token = await getBearerToken();
      const res = await fetch("/api/profile/save-phone", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ phone: newPhone.trim() }),
      });
      if (res.ok) { setMsg({ type: "success", text: "Telefonnummer oppdatert." }); setNewPhone(""); setOtp(""); setOtpSent(false); onSaved(); }
      else { const d = await res.json(); setMsg({ type: "error", text: d.error ?? "Feil ved lagring." }); }
    } finally { setSaving(false); }
  }

  return (
    <div className="space-y-3">
      {profile?.phone && (
        <div className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-sm">
          <span className="text-gray-500 text-xs">Nåværende:</span>
          <span className="font-medium text-gray-900">{profile.phone}</span>
          {profile.phone_verified_at && (
            <span className="ml-auto flex items-center gap-1 text-xs text-green-600">
              <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
              Verifisert
            </span>
          )}
        </div>
      )}
      <div className="flex gap-2">
        <input type="tel" value={newPhone} onChange={e => { setNewPhone(e.target.value); setOtpSent(false); }} disabled={otpSent}
          placeholder={profile?.phone ? "Nytt nummer" : "Telefonnummer"}
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400 disabled:bg-gray-50" />
        <button type="button" onClick={otpSent ? sendOtp : sendOtp} disabled={sending || !newPhone.trim()}
          className="shrink-0 rounded-lg bg-orange-500 px-3 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50">
          {sending ? "Sender…" : otpSent ? "Send på nytt" : "Send kode"}
        </button>
      </div>
      {otpSent && (
        <div className="flex gap-2">
          <input type="text" inputMode="numeric" maxLength={6} value={otp} onChange={e => setOtp(e.target.value)}
            placeholder="6-sifret kode"
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400" />
          <button type="button" onClick={verifyAndSave} disabled={verifying || saving || otp.length < 4}
            className="shrink-0 rounded-lg border border-orange-500 px-3 py-2 text-sm font-medium text-orange-600 hover:bg-orange-50 disabled:opacity-50">
            {verifying ? "Sjekker…" : saving ? "Lagrer…" : "Bekreft"}
          </button>
        </div>
      )}
      {msg && <div className={`rounded-lg px-3 py-2 text-sm ${msg.type === "success" ? "bg-green-50 text-green-700" : msg.type === "error" ? "bg-red-50 text-red-700" : "bg-blue-50 text-blue-700"}`}>{msg.text}</div>}
      <div ref={containerRef} />
    </div>
  );
}

// ── Address ──────────────────────────────────────────────────────────────────
function AddressSection({ profile, onSaved }: { profile: UserProfile | null; onSaved: () => void }) {
  const [newAddress, setNewAddress] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<Msg | null>(null);

  async function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault();
    if (!newAddress.trim()) return;
    setSaving(true); setMsg(null);
    const token = await getBearerToken();
    const res = await fetch("/api/profile/request-address", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ address: newAddress.trim() }),
    });
    setSaving(false);
    if (res.ok) { setMsg({ type: "info", text: "Adresseendring sendt til godkjenning av administrator." }); setNewAddress(""); onSaved(); }
    else { const d = await res.json(); setMsg({ type: "error", text: d.error ?? "Feil ved innsending." }); }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {profile?.address && (
        <div className="rounded-lg bg-gray-50 px-3 py-2 text-sm">
          <span className="text-xs text-gray-500">Gjeldende adresse:</span>
          <p className="font-medium text-gray-900 mt-0.5">{profile.address}</p>
        </div>
      )}
      {profile?.address_pending && (
        <div className="flex items-center gap-2 rounded-lg bg-yellow-50 border border-yellow-200 px-3 py-2 text-sm text-yellow-800">
          <svg className="h-4 w-4 shrink-0 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          Venter godkjenning: <span className="font-medium">{profile.address_pending}</span>
        </div>
      )}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          {profile?.address ? "Ny adresse (krever godkjenning)" : "Adresse (krever godkjenning)"}
        </label>
        <input type="text" value={newAddress} onChange={e => setNewAddress(e.target.value)}
          placeholder="Gateadresse, postnummer, sted"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400" />
        <p className="mt-1 text-xs text-gray-400">Adresseendring må godkjennes av en administrator før den trer i kraft.</p>
      </div>
      {msg && <div className={`rounded-lg px-3 py-2 text-sm ${msg.type === "success" ? "bg-green-50 text-green-700" : msg.type === "error" ? "bg-red-50 text-red-700" : "bg-blue-50 text-blue-700"}`}>{msg.text}</div>}
      <button type="submit" disabled={saving || !newAddress.trim()}
        className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50 transition-colors">
        {saving ? "Sender…" : "Send til godkjenning"}
      </button>
    </form>
  );
}

// ── Change log ───────────────────────────────────────────────────────────────
function ChangeLog({ changes }: { changes: ChangeLog[] }) {
  if (changes.length === 0) return <p className="text-sm text-gray-400 italic">Ingen endringer registrert ennå.</p>;
  return (
    <ol className="relative border-l border-gray-200 ml-2 space-y-4">
      {changes.map((c) => (
        <li key={c.id} className="ml-4">
          <span className="absolute -left-1.5 mt-1 h-3 w-3 rounded-full border-2 border-white bg-orange-400" />
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-gray-800">{TYPE_LABELS[c.change_type] ?? c.change_type}</span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[c.status] ?? "bg-gray-100 text-gray-500"}`}>
              {STATUS_LABELS[c.status] ?? c.status}
            </span>
          </div>
          <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-gray-500">
            {c.old_value && <span>Fra: <span className="text-gray-700">{c.old_value}</span></span>}
            {c.new_value && <span>Til: <span className="text-gray-700">{c.new_value}</span></span>}
          </div>
          <p className="mt-0.5 text-xs text-gray-400">
            {formatDt(c.changed_at)}
            {c.reviewed_by && <> · Behandlet av <span className="font-medium">{c.reviewed_by}</span></>}
            {c.note && <> · <span className="italic">{c.note}</span></>}
          </p>
        </li>
      ))}
    </ol>
  );
}

// ── Main export ──────────────────────────────────────────────────────────────
type Tab = "profil" | "telefon" | "adresse" | "logg";

export default function ProfileEditor() {
  const [tab, setTab] = useState<Tab>("profil");
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [changes, setChanges] = useState<ChangeLog[]>([]);
  const [loadingProfile, setLoadingProfile] = useState(true);

  async function fetchProfile() {
    const res = await fetch("/api/profile/me");
    const json = await res.json();
    setProfile(json.profile ?? null);
    setLoadingProfile(false);
  }

  async function fetchChanges() {
    const res = await fetch("/api/profile/changes");
    const json = await res.json();
    setChanges(json.changes ?? []);
  }

  useEffect(() => { fetchProfile(); fetchChanges(); }, []);

  const tabs: { id: Tab; label: string }[] = [
    { id: "profil",   label: "Navn / E-post" },
    { id: "telefon",  label: "Telefon" },
    { id: "adresse",  label: "Adresse" },
    { id: "logg",     label: `Logg${changes.length ? ` (${changes.length})` : ""}` },
  ];

  const pendingCount = changes.filter(c => c.status === "pending_approval").length;

  return (
    <div className="mt-4">
      {/* Tab bar */}
      <div className="flex gap-1 rounded-lg bg-gray-100 p-1 mb-5">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-all ${tab === t.id ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}>
            {t.label}
            {t.id === "adresse" && pendingCount > 0 && (
              <span className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-yellow-400 text-[10px] font-bold text-white">{pendingCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "profil" && (
        <ProfileSection onLogged={() => { fetchChanges(); }} />
      )}
      {tab === "telefon" && (
        loadingProfile
          ? <div className="h-16 animate-pulse rounded-lg bg-gray-100" />
          : <PhoneSection profile={profile} onSaved={() => { fetchProfile(); fetchChanges(); }} />
      )}
      {tab === "adresse" && (
        loadingProfile
          ? <div className="h-16 animate-pulse rounded-lg bg-gray-100" />
          : <AddressSection profile={profile} onSaved={() => { fetchProfile(); fetchChanges(); }} />
      )}
      {tab === "logg" && (
        <ChangeLog changes={changes} />
      )}
    </div>
  );
}

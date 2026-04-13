import Link from "next/link";

const BRAND = "#e2520a";

const features = [
  {
    icon: "⬛",
    title: "3D-konfigurator",
    desc: "Se garasjen ta form i sanntid mens du justerer lengde, bredde og portåpning.",
  },
  {
    icon: "📐",
    title: "Skreddersydd størrelse",
    desc: "Velg dimensjoner fra 2,4 til 9 meter – sideveggene beregnes automatisk.",
  },
  {
    icon: "💰",
    title: "Pris med én gang",
    desc: "Prisestimatet oppdateres øyeblikkelig basert på dimensjonene du velger.",
  },
];

const steps = [
  { num: "01", title: "Angi dimensjoner", desc: "Bruk sliderne til å stille inn lengde og bredde på garasjen." },
  { num: "02", title: "Velg garasjeport", desc: "Bestem bredde og høyde på porten – vi beregner sideveggene automatisk." },
  { num: "03", title: "Send forespørsel", desc: "Fornøyd med designet? Send en uforpliktende forespørsel direkte fra konfiguratoren." },
];

export default function Home() {
  return (
    <>
      {/* ── Hero ────────────────────────────────────────────────────── */}
      <section className="relative flex min-h-[92vh] flex-col items-center justify-center overflow-hidden bg-[#0D0D0D] px-6 text-center">
        {/* Warm glow */}
        <div
          className="pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2 h-[55vh] w-[80vw] rounded-full opacity-20 blur-[120px]"
          style={{ background: BRAND }}
        />

        {/* Badge */}
        <div
          className="mb-8 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-semibold uppercase tracking-widest"
          style={{ borderColor: `${BRAND}55`, color: BRAND }}
        >
          <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: BRAND }} />
          3D-konfigurator – prøv gratis
        </div>

        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white leading-[1.05] max-w-4xl">
          Design din{" "}
          <span style={{ color: BRAND }}>drømmegarasje</span>
          {" "}på sekunder
        </h1>

        <p className="mt-6 max-w-xl text-base sm:text-lg text-white/50 leading-relaxed">
          Juster dimensjoner, velg garasjeport og se et sanntids prisestimat.
          Helt uforpliktende.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row items-center gap-4">
          <Link
            href="/configurator"
            className="rounded-lg px-8 py-3.5 text-base font-bold text-white shadow-lg transition-all hover:brightness-110 active:scale-95"
            style={{ backgroundColor: BRAND }}
          >
            Start konfigurator
          </Link>
          <Link
            href="/interesse"
            className="rounded-lg border border-white/15 px-8 py-3.5 text-base font-medium text-white/70 hover:border-white/30 hover:text-white transition-colors"
          >
            Ta kontakt →
          </Link>
        </div>

        {/* Stats */}
        <div className="mt-16 flex flex-wrap justify-center gap-8 sm:gap-16">
          {[
            ["2,4 – 9 m", "Størrelsesvalg"],
            ["Sanntid", "3D-visning"],
            ["Uforpliktende", "Prisestimat"],
          ].map(([val, label]) => (
            <div key={label} className="flex flex-col items-center gap-1">
              <span className="text-xl font-bold text-white">{val}</span>
              <span className="text-white/35 uppercase tracking-wider text-xs">{label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────────────── */}
      <section className="bg-[#111111] py-24 px-6">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-2xl sm:text-3xl font-bold text-white text-center mb-14">
            Alt du trenger – samlet på ett sted
          </h2>
          <div className="grid sm:grid-cols-3 gap-6">
            {features.map((f) => (
              <div
                key={f.title}
                className="rounded-xl border border-white/8 bg-white/[0.03] p-7 hover:border-white/15 transition-colors"
              >
                <div className="text-3xl mb-4">{f.icon}</div>
                <h3 className="text-base font-semibold text-white mb-2">{f.title}</h3>
                <p className="text-sm text-white/45 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Steps ───────────────────────────────────────────────────── */}
      <section id="slik-fungerer" className="bg-[#0D0D0D] py-24 px-6">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-2xl sm:text-3xl font-bold text-white text-center mb-16">
            Slik fungerer det
          </h2>
          <div className="flex flex-col">
            {steps.map((s, i) => (
              <div key={s.num} className="flex gap-8 items-start">
                <div className="flex flex-col items-center">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                    style={{ backgroundColor: BRAND }}
                  >
                    {s.num}
                  </div>
                  {i < steps.length - 1 && (
                    <div className="mt-2 h-16 w-px bg-white/10" />
                  )}
                </div>
                <div className="pb-10">
                  <h3 className="text-base font-semibold text-white mb-1">{s.title}</h3>
                  <p className="text-sm text-white/45 leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 text-center">
            <Link
              href="/configurator"
              className="inline-flex rounded-lg px-8 py-3.5 text-sm font-bold text-white hover:brightness-110 transition-all"
              style={{ backgroundColor: BRAND }}
            >
              Prøv konfiguratoren nå
            </Link>
          </div>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────────────── */}
      <section className="bg-[#111111] border-t border-white/8 py-20 px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">
            Klar til å komme i gang?
          </h2>
          <p className="text-white/45 text-sm mb-8 leading-relaxed">
            Design garasjen din på noen minutter og få et prisestimat med én gang.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/configurator"
              className="rounded-lg px-8 py-3.5 text-sm font-bold text-white hover:brightness-110 transition-all"
              style={{ backgroundColor: BRAND }}
            >
              Åpne konfigurator
            </Link>
            <Link
              href="/interesse"
              className="rounded-lg border border-white/15 px-8 py-3.5 text-sm font-medium text-white/70 hover:text-white hover:border-white/30 transition-colors"
            >
              Send forespørsel
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

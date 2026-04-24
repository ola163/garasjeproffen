import Link from "next/link";

export const metadata = {
  title: "Materialpakke garasje | Alt du trenger for selvbygging | GarasjeProffen AS",
  description: "Kjøp en komplett materialpakke for garasje fra GarasjeProffen AS. Alle materialer spesifisert og klare for selvbygging eller montering av egne håndverkere. Rogaland og hele Norge.",
  alternates: { canonical: "https://www.garasjeproffen.no/materialpakke-garasje" },
};

export default function MaterialpakkeGarasje() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-12 sm:py-20">
      <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
        Materialpakke for garasje
      </h1>
      <p className="mt-4 text-lg text-gray-600">
        Vil du bygge garasjen selv, eller bruke dine egne håndverkere? Vår materialpakke gir deg alt du trenger – spesifisert og kvalitetssikret – slik at du slipper å samle materialer fra mange leverandører.
      </p>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-gray-900">Hva er inkludert?</h2>
        <ul className="mt-4 space-y-2 text-gray-600">
          {[
            "Alle konstruksjonsmaterialer i tre (stendere, bjelker, sperrer)",
            "Kledning og panel etter valgt design",
            "Tak og undertaket",
            "Vinduer og dør etter konfigurasjon",
            "Garasjeport (valgfritt)",
            "Komplett stykliste med varenummer og mengde",
          ].map((item) => (
            <li key={item} className="flex items-start gap-2">
              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-orange-500" />
              {item}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10 rounded-xl border border-orange-100 bg-orange-50 p-6 sm:p-8">
        <h2 className="text-xl font-semibold text-gray-900">Fordeler med materialpakke</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {[
            { title: "Spar tid", desc: "Alt spesifisert og samlet – du bestiller én pakke, ikke 20 produkter fra ulike leverandører." },
            { title: "Trygg prissetting", desc: "Du vet nøyaktig hva du betaler for materialene. Bruk konfiguratoren for prisestimat." },
            { title: "Fleksibelt", desc: "Bruk egne håndverkere eller bygg selv. Pakken fungerer uansett hvem som monterer." },
            { title: "Tilpasset din tomt", desc: "Vi tilpasser spesifikasjonen til dine mål og ønsker via 3D-konfiguratoren." },
          ].map((item) => (
            <div key={item.title}>
              <p className="font-semibold text-gray-900">{item.title}</p>
              <p className="mt-1 text-sm text-gray-600">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-10 flex flex-wrap gap-4">
        <Link href="/configurator" className="rounded-lg bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 transition-colors">
          Konfigurer og få prisestimat
        </Link>
        <Link href="/prefabrikkert-garasje" className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
          Se prefabrikkert alternativet
        </Link>
      </div>
    </div>
  );
}

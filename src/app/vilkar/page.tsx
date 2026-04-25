import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Brukervilkår og personvernerklæring",
  description: "Les GarasjeProffen AS sine brukervilkår og personvernerklæring.",
  alternates: { canonical: "https://www.garasjeproffen.no/vilkar" },
};

const TERMS_VERSION = "1.0";
const PRIVACY_VERSION = "1.0";
const LAST_UPDATED = "2025-04-25";

const sections = [
  { id: "brukervilkar", label: "Brukervilkår" },
  { id: "personvern",   label: "Personvernerklæring" },
];

export default function VilkarPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-12">

      {/* Top navigation */}
      <nav className="mb-10 flex flex-wrap gap-3">
        {sections.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:border-orange-400 hover:text-orange-600 transition-colors"
          >
            {s.label}
          </a>
        ))}
      </nav>

      {/* ─── BRUKERVILKÅR ─────────────────────────────────────────────────────── */}
      <section id="brukervilkar" className="mb-20 scroll-mt-24">
        <div className="mb-6 border-b border-gray-200 pb-4">
          <h1 className="text-3xl font-bold text-gray-900">Brukervilkår</h1>
          <p className="mt-2 text-sm text-gray-500">
            GarasjeProffen AS · Versjon {TERMS_VERSION} · Sist oppdatert {LAST_UPDATED}
          </p>
        </div>

        <div className="prose prose-gray max-w-none space-y-8 text-[15px] leading-relaxed text-gray-700">

          <div>
            <h2 className="mb-3 text-lg font-semibold text-gray-900">1. Generelt</h2>
            <p>
              Disse brukervilkårene gjelder for bruk av GarasjeProffen AS sine digitale tjenester,
              inkludert nettsted, konfigurator, chatbot, brukerkonto og øvrige digitale hjelpemidler
              (heretter «tjenestene»). Ved å opprette brukerkonto eller benytte tjenestene aksepterer
              du disse vilkårene.
            </p>
            <p className="mt-3">
              GarasjeProffen AS er behandlingsansvarlig. Kontaktinformasjon:
              org.nr. [org.nr.], [adresse], e-post: post@garasjeproffen.no.
            </p>
          </div>

          <div>
            <h2 className="mb-3 text-lg font-semibold text-gray-900">2. Brukerkonto</h2>
            <p>
              Du kan opprette en personlig brukerkonto for å følge opp tilbudsforespørsler,
              lagre konfigurasjoner og kommunisere med GarasjeProffen. Kontoen er personlig og
              skal ikke deles med andre.
            </p>
            <p className="mt-3">
              Du er selv ansvarlig for å holde innloggingsinformasjonen din (e-post og passord)
              hemmelig. Misbruk av kontoen skal varsles til GarasjeProffen umiddelbart på
              post@garasjeproffen.no. GarasjeProffen kan suspendere eller slette kontoer som
              brukes i strid med disse vilkårene.
            </p>
          </div>

          <div>
            <h2 className="mb-3 text-lg font-semibold text-gray-900">3. Brukerens ansvar for riktig informasjon</h2>
            <p>
              Du er ansvarlig for at informasjonen du oppgir gjennom tjenestene – inkludert
              kontaktinformasjon, prosjektinformasjon, eiendomsdata og andre opplysninger – er
              korrekt og oppdatert. Feil eller ufullstendig informasjon kan føre til at tilbud,
              priser og vurderinger ikke er presise.
            </p>
            <p className="mt-3">
              GarasjeProffen forbeholder seg retten til å be om dokumentasjon eller bekreftelse
              av opplysninger, og kan avvise forespørsler som er basert på ufullstendig eller
              misvisende informasjon.
            </p>
          </div>

          <div>
            <h2 className="mb-3 text-lg font-semibold text-gray-900">4. Konfigurator, priser og AI-svar er veiledende</h2>
            <p>
              Priser, beregninger og konfigurasjoner generert av konfiguratoren, priskalkulatoren
              eller andre digitale verktøy er veiledende estimater, ikke bindende tilbud.
              Faktisk pris kan avvike som følge av lokale forhold, materialprisendringer,
              tilpasninger, frakt, montering og andre faktorer.
            </p>
            <p className="mt-3">
              Svar og anbefalinger fra GarasjeProffens AI-chatbot (GarasjeDrøsaren) er generert
              av et automatisert system og er utelukkende veiledende. AI-svar kan inneholde feil
              eller unøyaktigheter. De skal aldri alene legges til grunn for bestilling,
              byggesøknad, tekniske vurderinger eller andre beslutninger uten at disse er bekreftet
              av GarasjeProffen eller en relevant fagperson.
            </p>
          </div>

          <div>
            <h2 className="mb-3 text-lg font-semibold text-gray-900">5. Endelig pris og leveranse</h2>
            <p>
              Endelig pris og leveransevilkår for garasje, carport, materialpakke, prefabrikkerte
              løsninger og søknadshjelp avtales skriftlig mellom deg og GarasjeProffen AS.
              Ingen bindende avtale er inngått før begge parter har bekreftet dette skriftlig.
            </p>
          </div>

          <div>
            <h2 className="mb-3 text-lg font-semibold text-gray-900">6. Byggesøknad og kommunal godkjenning</h2>
            <p>
              GarasjeProffen kan tilby hjelp med byggesøknad og nabovarsling som en del av sine
              tjenester. GarasjeProffen kan imidlertid ikke garantere at kommunen godkjenner
              en søknad. Godkjenning er avhengig av reguleringsplan, kommunale krav og andre
              forhold som GarasjeProffen ikke har kontroll over. Eventuell avvisning fra
              kommunen gir ikke automatisk rett til refusjon av søknadsgebyr.
            </p>
          </div>

          <div>
            <h2 className="mb-3 text-lg font-semibold text-gray-900">7. Ansvar for opplastet innhold</h2>
            <p>
              Du er selv ansvarlig for at filer, bilder, tegninger og andre dokumenter du laster
              opp via tjenestene ikke krenker tredjeparts rettigheter (herunder opphavsrett),
              ikke inneholder ulovlig materiale, og er relevante for det aktuelle prosjektet.
            </p>
            <p className="mt-3">
              GarasjeProffen forbeholder seg retten til å slette opplastet materiale som er
              i strid med disse vilkårene eller gjeldende lovgivning.
            </p>
          </div>

          <div>
            <h2 className="mb-3 text-lg font-semibold text-gray-900">8. Immaterielle rettigheter</h2>
            <p>
              Alt innhold på GarasjeProffens nettsted og i tjenestene – inkludert tekst, bilder,
              grafikk, design, konfiguratorer og kode – tilhører GarasjeProffen AS eller
              tredjeparter som har gitt GarasjeProffen bruksrett. Innholdet må ikke reproduseres,
              distribueres eller brukes kommersielt uten skriftlig tillatelse.
            </p>
            <p className="mt-3">
              Brukergenerert innhold (f.eks. tegninger eller prosjektbeskrivelser) forblir
              brukerens eiendom, men brukeren gir GarasjeProffen en begrenset, vederlagsfri
              rettighet til å bruke slikt innhold for å levere de avtalte tjenestene.
            </p>
          </div>

          <div>
            <h2 className="mb-3 text-lg font-semibold text-gray-900">9. Ansvarsbegrensning</h2>
            <p>
              GarasjeProffen er ikke ansvarlig for tap som følge av feil i konfiguratoren,
              priskalkulatoren, AI-chatboten eller andre digitale verktøy, herunder rene
              formuestap som oppstår ved at brukeren handler på bakgrunn av veiledende informasjon
              uten skriftlig bekreftelse fra GarasjeProffen.
            </p>
            <p className="mt-3">
              GarasjeProffen er heller ikke ansvarlig for midlertidig utilgjengelighet av
              tjenestene som følge av tekniske feil, vedlikehold eller utenforliggende årsaker.
            </p>
          </div>

          <div>
            <h2 className="mb-3 text-lg font-semibold text-gray-900">10. Endring av vilkår</h2>
            <p>
              GarasjeProffen kan endre disse brukervilkårene ved å publisere en ny versjon på
              denne siden. Vesentlige endringer varsles på e-post til registrerte brukere med
              minst 14 dagers varsel. Fortsatt bruk av tjenestene etter at varselet er sendt
              anses som aksept av de oppdaterte vilkårene. Dersom du ikke aksepterer endringene,
              kan du avslutte kontoen din.
            </p>
          </div>

          <div>
            <h2 className="mb-3 text-lg font-semibold text-gray-900">11. Lovvalg og verneting</h2>
            <p>
              Disse vilkårene reguleres av norsk rett. Eventuelle tvister som ikke løses i
              minnelighet, avgjøres av norske domstoler med Jæren tingrett som verneting,
              med mindre annet følger av preseptorisk lovgivning.
            </p>
          </div>

        </div>
      </section>

      {/* ─── PERSONVERNERKLÆRING ─────────────────────────────────────────────── */}
      <section id="personvern" className="scroll-mt-24">
        <div className="mb-6 border-b border-gray-200 pb-4">
          <h1 className="text-3xl font-bold text-gray-900">Personvernerklæring</h1>
          <p className="mt-2 text-sm text-gray-500">
            GarasjeProffen AS · Versjon {PRIVACY_VERSION} · Sist oppdatert {LAST_UPDATED}
          </p>
        </div>

        <div className="prose prose-gray max-w-none space-y-8 text-[15px] leading-relaxed text-gray-700">

          <div>
            <h2 className="mb-3 text-lg font-semibold text-gray-900">1. Behandlingsansvarlig</h2>
            <p>
              GarasjeProffen AS (org.nr. [org.nr.]) er behandlingsansvarlig for personopplysninger
              som samles inn gjennom våre digitale tjenester. Vi er forpliktet til å behandle
              personopplysninger i samsvar med personopplysningsloven og EUs personvernforordning
              (GDPR).
            </p>
            <p className="mt-3">
              Kontakt oss om personvern: post@garasjeproffen.no · [adresse] · Tlf. +47 476 17 563
            </p>
          </div>

          <div>
            <h2 className="mb-3 text-lg font-semibold text-gray-900">2. Hvilke personopplysninger samler vi inn?</h2>

            <h3 className="mb-2 mt-4 font-semibold text-gray-800">Kontaktinformasjon</h3>
            <p>
              Navn, e-postadresse, telefonnummer og postadresse – oppgitt av deg ved opprettelse
              av brukerkonto, innsending av forespørsel eller via kontaktskjema.
            </p>

            <h3 className="mb-2 mt-4 font-semibold text-gray-800">Prosjekt- og eiendomsinformasjon</h3>
            <p>
              Garasjekonfigurasjon (mål, taktype, tilleggselementer), bygningstype, prisestimat,
              eiendomsadresse, kommunale opplysninger, kart- og plasseringsdata samt eventuelle
              beskrivelser eller notater knyttet til prosjektet.
            </p>

            <h3 className="mb-2 mt-4 font-semibold text-gray-800">Brukerkonto</h3>
            <p>
              E-postadresse, kryptert passord (lagret hos Supabase, ikke synlig for
              GarasjeProffen), telefonnummer med verifiseringstidspunkt, adresseopplysninger
              og akseptinformasjon for brukervilkår (tidspunkt, versjon, kilde og teknisk
              informasjon om enheten).
            </p>

            <h3 className="mb-2 mt-4 font-semibold text-gray-800">Chatbot-dialoger og AI-interaksjoner</h3>
            <p>
              Se eget avsnitt om AI og chatbot nedenfor (avsnitt 3).
            </p>

            <h3 className="mb-2 mt-4 font-semibold text-gray-800">Skjemaer og forespørsler</h3>
            <p>
              Informasjon du sender inn via kontaktskjema, søknadshjelp-skjema, tilbudsforespørsler
              og andre digitale skjemaer, inkludert fritekstmeldinger.
            </p>

            <h3 className="mb-2 mt-4 font-semibold text-gray-800">Opplastede filer, bilder og dokumenter</h3>
            <p>
              Dersom du laster opp tegninger, fotografier, situasjonsplaner eller andre filer
              som del av en forespørsel eller et prosjekt, lagres disse på våre servere for
              prosjektoppfølging.
            </p>

            <h3 className="mb-2 mt-4 font-semibold text-gray-800">Tekniske logger og sikkerhetslogger</h3>
            <p>
              IP-adresse, nettlesertype og versjon, operativsystem, enhetstype, tidspunkt for
              innlogging og aktivitet, feilmeldinger og tekniske hendelser. Disse samles inn
              automatisk som en del av normal drift og sikring av tjenestene.
            </p>

            <h3 className="mb-2 mt-4 font-semibold text-gray-800">Betalings- og ordredata</h3>
            <p>
              Dersom betaling gjennomføres via Klarna eller annen betalingstjeneste, behandles
              betalingsinformasjon av den aktuelle betalingstjenesteleverandøren. GarasjeProffen
              lagrer ordrereferanse, betalingsstatus og faktureringsgrunnlag, men ikke
              kortinformasjon eller bankdetaljer.
            </p>

            <h3 className="mb-2 mt-4 font-semibold text-gray-800">Cookies og analyseverktøy</h3>
            <p>
              Se eget avsnitt om cookies (avsnitt 9).
            </p>
          </div>

          {/* AI Section */}
          <div className="rounded-xl border-2 border-orange-200 bg-orange-50 p-6">
            <h2 className="mb-3 text-lg font-semibold text-orange-900">
              3. AI-chatbot og kunstig intelligens
            </h2>

            <div className="space-y-3 text-[15px] text-orange-900">
              <p>
                GarasjeProffen bruker en AI-drevet chatbot (GarasjeDrøsaren) på nettstedet.
                Chatboten er et <strong>automatisert system</strong> – du kommuniserer ikke med
                et menneske når du bruker denne funksjonen.
              </p>

              <p>
                <strong>Hva lagres:</strong> Meldinger du sender i chatboten, samt teknisk
                informasjon (sesjons-ID, tidspunkt, språkvalg), kan lagres. Dialoghistorikk
                kan brukes til:
              </p>
              <ul className="ml-4 list-disc space-y-1">
                <li>Å svare på og følge opp din henvendelse</li>
                <li>Prosjektoppfølging og tilbudsarbeid</li>
                <li>Kvalitetssikring og forbedring av tjenesten</li>
                <li>Sikkerhetsgjennomgang og feilretting</li>
              </ul>

              <p>
                GarasjeProffen kan manuelt gjennomgå chatbot-dialoger ved behov, for eksempel
                i forbindelse med kundeoppfølging, klagebehandling eller sikkerhetshendelser.
              </p>

              <p>
                <strong>Ikke skriv inn sensitive opplysninger i chatboten</strong>, herunder
                fødselsnummer, passord, BankID-informasjon eller betalingskortinformasjon.
                Chatboten er ikke konstruert for å håndtere slike data sikkert.
              </p>

              <p>
                <strong>Begrensninger ved AI-svar:</strong> Svar fra chatboten er generert av
                kunstig intelligens og kan inneholde feil, unøyaktigheter eller foreldede
                opplysninger. AI-svar skal ikke alene regnes som juridisk, teknisk, byggfaglig
                eller økonomisk rådgivning. Pris, byggesøknad, tekniske spesifikasjoner og
                bestillinger må bekreftes av GarasjeProffen eller relevant fagperson før de
                legges til grunn.
              </p>

              <p>
                <strong>Underleverandører for AI og drift:</strong> GarasjeProffen benytter
                eksterne leverandører av AI-tjenester og sky-/driftstjenester (bl.a. Anthropic
                og Supabase). Disse kan behandle data på vegne av GarasjeProffen i henhold til
                databehandleravtaler. Se avsnitt 7 for mer informasjon.
              </p>
            </div>
          </div>

          <div>
            <h2 className="mb-3 text-lg font-semibold text-gray-900">4. Formål med behandlingen</h2>
            <p>Vi behandler personopplysninger for følgende formål:</p>
            <ul className="ml-4 mt-2 list-disc space-y-2">
              <li>Administrere brukerkonto og innlogging</li>
              <li>Behandle tilbudsforespørsler og gi prisestimater</li>
              <li>Levere søknadshjelp og prosjektoppfølging</li>
              <li>Kommunisere med deg om ditt prosjekt</li>
              <li>Drifte, sikre og forbedre tjenestene</li>
              <li>Oppfylle regnskapsmessige og skattemessige forpliktelser</li>
              <li>Sende markedsføring på e-post/SMS, dersom du har samtykket til dette</li>
            </ul>
          </div>

          <div>
            <h2 className="mb-3 text-lg font-semibold text-gray-900">5. Behandlingsgrunnlag</h2>
            <p>
              Vi behandler personopplysninger på grunnlag av GDPR artikkel 6, avhengig av formålet:
            </p>
            <div className="mt-4 overflow-hidden rounded-xl border border-gray-200">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-semibold text-gray-700">Grunnlag</th>
                    <th className="px-4 py-2.5 text-left font-semibold text-gray-700">Gjelder for</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr>
                    <td className="px-4 py-3 font-medium text-gray-800">Avtale (art. 6.1.b)</td>
                    <td className="px-4 py-3 text-gray-600">
                      Brukerkonto, tilbudsforespørsler, prosjektinformasjon, kommunikasjon
                      om pågående prosjekter
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium text-gray-800">Rettslig plikt (art. 6.1.c)</td>
                    <td className="px-4 py-3 text-gray-600">
                      Regnskap, faktura, skattemessige forpliktelser etter regnskapsloven
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium text-gray-800">Berettiget interesse (art. 6.1.f)</td>
                    <td className="px-4 py-3 text-gray-600">
                      Sikkerhetslogger, tekniske logger, svindelforebygging, driftssikkerhet,
                      kvalitetssikring av chatbot-dialoger
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium text-gray-800">Frivillig samtykke (art. 6.1.a)</td>
                    <td className="px-4 py-3 text-gray-600">
                      Markedsføring på e-post og SMS. Samtykket kan trekkes tilbake når som helst.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h2 className="mb-3 text-lg font-semibold text-gray-900">6. Lagringstid og sletting</h2>
            <p>
              Vi lagrer personopplysninger ikke lenger enn nødvendig for de formål de ble samlet inn til:
            </p>
            <ul className="ml-4 mt-2 list-disc space-y-2">
              <li>
                <strong>Brukerkonto:</strong> Så lenge kontoen er aktiv. Inaktive kontoer kan
                slettes etter 3 år uten aktivitet, med forhåndsvarsel.
              </li>
              <li>
                <strong>Tilbudsforespørsler og prosjektdata:</strong> 5 år etter prosjektavslutning,
                i samsvar med regnskapslovens krav.
              </li>
              <li>
                <strong>Chatbot-dialoger:</strong> Inntil 12 måneder, med mindre de er tilknyttet
                et aktivt prosjekt.
              </li>
              <li>
                <strong>Tekniske og sikkerhetslogger:</strong> Inntil 12 måneder.
              </li>
              <li>
                <strong>Markedsføringssamtykke:</strong> Frem til du trekker samtykket tilbake.
              </li>
            </ul>
            <p className="mt-3">
              Du kan be om sletting av dine personopplysninger etter GDPR artikkel 17. Slettingsanmodninger
              behandles etter gjeldende rett – vi plikter ikke slette data vi er lovpålagt å oppbevare.
            </p>
          </div>

          <div>
            <h2 className="mb-3 text-lg font-semibold text-gray-900">
              7. Deling med leverandører og databehandlere
            </h2>
            <p>
              Vi deler personopplysninger med tredjeparter kun i den grad det er nødvendig for
              å levere tjenestene, og alltid med databehandleravtale der dette kreves:
            </p>
            <ul className="ml-4 mt-2 list-disc space-y-2">
              <li><strong>Supabase:</strong> Database og autentisering (brukerkontoer, prosjektdata)</li>
              <li><strong>Anthropic:</strong> AI-modell for chatbot-funksjonen</li>
              <li><strong>Firebase (Google):</strong> SMS-verifisering av mobilnummer</li>
              <li><strong>Klarna:</strong> Betalingsformidling</li>
              <li><strong>Resend:</strong> Utsending av e-post</li>
              <li><strong>Vercel:</strong> Hosting og driftsmiljø for nettstedet</li>
            </ul>
            <p className="mt-3">
              Vi selger ikke personopplysninger til tredjeparter og bruker dem ikke til egne
              kommersielle formål utenfor det som er beskrevet i denne erklæringen.
            </p>
          </div>

          <div>
            <h2 className="mb-3 text-lg font-semibold text-gray-900">8. Overføring utenfor EU/EØS</h2>
            <p>
              Noen av våre leverandører (bl.a. Anthropic og Vercel) er basert i USA. Overføring
              til tredjeland skjer i henhold til GDPR kapittel V, enten på grunnlag av
              EU-kommisjonens standard databehandlerklausuler (SCC) eller andre godkjente
              overføringsmekanismer. Du kan be om mer informasjon om dette ved å kontakte oss.
            </p>
          </div>

          <div>
            <h2 className="mb-3 text-lg font-semibold text-gray-900">9. Cookies</h2>
            <p>
              GarasjeProffen bruker cookies (informasjonskapsler) på nettstedet. Vi skiller
              mellom to kategorier:
            </p>
            <div className="mt-4 overflow-hidden rounded-xl border border-gray-200">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-semibold text-gray-700">Type</th>
                    <th className="px-4 py-2.5 text-left font-semibold text-gray-700">Formål</th>
                    <th className="px-4 py-2.5 text-left font-semibold text-gray-700">Grunnlag</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr>
                    <td className="px-4 py-3 font-medium text-gray-800">Nødvendige cookies</td>
                    <td className="px-4 py-3 text-gray-600">
                      Sesjonshåndtering (innlogging), sikkerhetstoken, teknisk drift
                    </td>
                    <td className="px-4 py-3 text-gray-600">Nødvendig for tjenesten</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium text-gray-800">Analyse- og sporingscookies</td>
                    <td className="px-4 py-3 text-gray-600">
                      Bruksmålinger, statistikk, forbedring av tjenesten
                    </td>
                    <td className="px-4 py-3 text-gray-600">Krever ditt samtykke</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-3">
              Ikke-nødvendige cookies aktiveres kun etter at du har gitt samtykke. Du kan
              endre eller trekke tilbake ditt cookiesamtykke når som helst.
            </p>
          </div>

          <div>
            <h2 className="mb-3 text-lg font-semibold text-gray-900">10. Dine rettigheter</h2>
            <p>
              Etter GDPR har du følgende rettigheter, som du kan utøve ved å kontakte oss på
              post@garasjeproffen.no:
            </p>
            <ul className="ml-4 mt-2 list-disc space-y-2">
              <li><strong>Innsyn (art. 15):</strong> Du har rett til å vite hvilke opplysninger vi har om deg.</li>
              <li><strong>Retting (art. 16):</strong> Du kan kreve at uriktige opplysninger korrigeres.</li>
              <li><strong>Sletting (art. 17):</strong> Du kan kreve sletting av opplysninger vi ikke lenger har rettslig grunnlag for å oppbevare.</li>
              <li><strong>Begrensning (art. 18):</strong> Du kan kreve at behandlingen begrenses i visse situasjoner.</li>
              <li><strong>Dataportabilitet (art. 20):</strong> Du kan be om å få dine opplysninger utlevert i et maskinlesbart format.</li>
              <li><strong>Protest (art. 21):</strong> Du kan protestere mot behandling basert på berettiget interesse.</li>
              <li>
                <strong>Tilbaketrekking av samtykke:</strong> Dersom behandlingen er basert på ditt
                samtykke (f.eks. markedsføring), kan du trekke det tilbake når som helst. Det påvirker
                ikke lovligheten av behandling som har funnet sted før tilbaketrekkingen.
              </li>
            </ul>
            <p className="mt-3">
              Vi svarer på henvendelser om personvern innen 30 dager. Vi har rett til å be om
              dokumentasjon på din identitet.
            </p>
          </div>

          <div>
            <h2 className="mb-3 text-lg font-semibold text-gray-900">11. Klage til Datatilsynet</h2>
            <p>
              Dersom du mener at vi behandler dine personopplysninger i strid med
              personvernregelverket, har du rett til å klage til Datatilsynet:
            </p>
            <p className="mt-2">
              Datatilsynet · Postboks 458 Sentrum, 0105 Oslo ·{" "}
              <a href="https://www.datatilsynet.no" className="text-orange-500 hover:underline" target="_blank" rel="noopener noreferrer">
                www.datatilsynet.no
              </a>
            </p>
            <p className="mt-2">
              Vi oppfordrer deg til å kontakte oss direkte først, slik at vi kan forsøke å
              løse eventuelle spørsmål raskt og uformelt.
            </p>
          </div>

          <div>
            <h2 className="mb-3 text-lg font-semibold text-gray-900">12. Endringer i personvernerklæringen</h2>
            <p>
              Denne personvernerklæringen kan oppdateres. Vesentlige endringer varsles til
              registrerte brukere via e-post. Gjeldende versjon er alltid tilgjengelig på{" "}
              <Link href="/vilkar#personvern" className="text-orange-500 hover:underline">
                garasjeproffen.no/vilkar
              </Link>
              .
            </p>
          </div>

        </div>
      </section>

      {/* Back to top */}
      <div className="mt-16 text-center">
        <a href="#" className="text-sm text-gray-400 hover:text-gray-600">↑ Tilbake til toppen</a>
      </div>
    </div>
  );
}

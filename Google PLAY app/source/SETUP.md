# GarasjeProffen App — Oppsett

## Krav
- Node.js 18+ (installer fra https://nodejs.org)
- Expo Go-appen på telefonen (fra App Store / Play Store)

## Kom i gang

```bash
# Installer avhengigheter
npm install

# Start utviklingsserver
npx expo start
```

Skann QR-koden i terminalen med Expo Go (Android) eller kameraet (iPhone).

## Assets (påkrevd)
Legg følgende filer i `assets/`-mappen:
- `icon.png` — 1024×1024 px, app-ikon (oransje bakgrunn anbefalt)
- `splash.png` — 1284×2778 px (eller bruk 1242×2436), splash-screen
- `adaptive-icon.png` — 1024×1024 px, Android adaptive icon (kun forgrunnen)

Eksisterende logoer fra garasjeproffen.no kan brukes som utgangspunkt.

## Publisering til stores

### 1. Opprett Expo-konto
```bash
npx expo login
```

### 2. Installer EAS CLI
```bash
npm install -g eas-cli
eas login
```

### 3. Konfigurer prosjektet
```bash
eas build:configure
```

### 4. Bygg for stores
```bash
# Android (.aab for Play Store)
eas build --platform android --profile production

# iOS (.ipa for App Store)
eas build --platform ios --profile production
```

### 5. Send inn
```bash
eas submit --platform android
eas submit --platform ios
```

For iOS trenger du Apple Developer-konto ($99/år). For Android trenger du Google Play Developer-konto ($25 engangsbetaling).

## Struktur

```
app/
├── _layout.tsx          # Root-layout med modal-navigasjon
├── tilbud.tsx           # Tilbudsforespørsel (modal)
└── (tabs)/
    ├── _layout.tsx      # Tab-navigasjon
    ├── index.tsx        # Konfiguratoren
    ├── referanser.tsx   # Bildegalleri fra Facebook
    └── kontakt.tsx      # Kontaktinfo og åpningstider
lib/
└── pricing.ts           # Prisberegning (synkronisert med nettapp)
constants/
└── Colors.ts            # Merkefarger
```

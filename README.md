# @clinicpro/consent

Cookie consent for the Clinic Pro websites, built to UK GDPR and PECR as the
ICO reads them. One package, installed in each site at a pinned version.

- A banner for anyone who has not chosen, with **Accept all** and **Reject
  all** given equal weight, and a settings dialog to choose by category.
- Nothing optional runs before consent. Trackers sit inside `<ConsentGate>`,
  third-party embeds such as Google Maps inside `<ConsentEmbed>`.
- **Google Consent Mode v2**: everything is denied by default before any
  Google tag loads, and updated the moment a choice is made.
- Withdrawing consent deletes that category's cookies and reloads the page
  once, so scripts that already ran stop.
- Choices last 182 days, then are asked again. Raising `version` asks
  everyone again straight away.
- A choice made in one tab applies in every open tab.
- Works with the Pages Router and the App Router, React 18 and 19.

## What it treats as what

| Category | Examples | Default |
| --- | --- | --- |
| Necessary | the consent cookie itself, reCAPTCHA on forms, the session | always on |
| Functional | Google Maps and other embeds that set cookies | off |
| Analytics | Google Analytics 4, GTM analytics tags | off |
| Marketing | Google Ads, Meta pixel | off |

A site lists only the categories it uses. Unlisted ones are never offered and
never granted.

Vercel Analytics is cookieless and needs no consent.

## Install

```bash
npm install github:dompaul/clinicpro-consent#v1.0.0
```

The version is pinned by tag. To take a later release, change the tag and
reinstall.

## Set up: Pages Router

### 1. Config, one file per site

`src/consent.config.ts`

```ts
import type { ConsentConfig } from "@clinicpro/consent";

export const consentConfig: ConsentConfig = {
  // Raise this whenever a tracker or a purpose is added.
  version: 1,
  policyUrl: "/cookie-policy",
  categories: {
    functional: {},
    analytics: {},
  },
  exclude: /^\/(admin|login)/,
};
```

### 2. The head script, first in `_document`

```tsx
import { ConsentHeadScript } from "@clinicpro/consent";
import { consentConfig } from "consent.config";

<Head>
  <ConsentHeadScript version={consentConfig.version} />
  {/* everything else */}
</Head>;
```

### 3. The provider and the styles, in `_app`

```tsx
import "@clinicpro/consent/styles.css";
import { ConsentProvider } from "@clinicpro/consent";
import { consentConfig } from "consent.config";

const router = useRouter();

<ConsentProvider config={consentConfig} pathname={router.pathname}>
  <Component {...pageProps} />
</ConsentProvider>;
```

### 4. Gate every tracker

```tsx
import { ConsentGate } from "@clinicpro/consent";

<ConsentGate category="analytics">
  <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
  <Script id="gtag-init" strategy="afterInteractive">{`
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', '${GA_ID}');
  `}</Script>
</ConsentGate>
```

Do not render any tracker outside a gate, and do not use the GTM `<noscript>`
iframe: without JavaScript there is no way to ask, so nothing may load.

### 5. Gate every embed that sets cookies

```tsx
import { ConsentEmbed } from "@clinicpro/consent";

<ConsentEmbed provider="Google Maps" what="map" className={styles.map}>
  <iframe src={MAP_EMBED_SRC} title="Map" loading="lazy" />
</ConsentEmbed>
```

The placeholder takes the same `className`, so it fills the map's box.

### 6. Cookie settings in the footer

```tsx
import { CookieSettingsButton } from "@clinicpro/consent";

<CookieSettingsButton className={styles.footerLink} />
```

## Set up: App Router

The same, except the head script comes from the server-safe entry:

```tsx
// app/layout.tsx (a server component)
import { consentModeScript } from "@clinicpro/consent/head";

<head>
  <script
    id="clinicpro-consent-default"
    nonce={nonce}
    dangerouslySetInnerHTML={{ __html: consentModeScript({ version: consentConfig.version }) }}
  />
</head>
```

and the provider goes in a client component that wraps `children`, passing
`usePathname()`.

## Theming

Set the variables on `:root` from the site's own tokens:

```css
:root {
  --cpc-font: var(--font-site), system-ui, sans-serif;
  --cpc-text: #0b1f33;
  --cpc-muted: #5e6873;
  --cpc-border: #ddd5c7;
  --cpc-accent: #0b1f33;
  --cpc-accent-hover: #164e8c;
  --cpc-radius: 12px;
  --cpc-panel-radius: 20px;
  --cpc-focus: 0 0 0 3px rgba(22, 78, 140, 0.25);
}
```

The full list is at the top of `dist/styles.css`.

## Reading the choice

```tsx
const { ready, choices, granted, openSettings } = useConsent();
if (granted("analytics")) trackSomething();
```

Outside React, the choice is announced as a `clinicpro-consent:change` window
event, `openCookieSettings()` opens the dialog, and on the server
`readConsent(req.headers.cookie, { version })` reads the cookie.

GTM also receives a `consent_update` dataLayer event with the choices.

## Wording

Every string can be replaced through `strings`, and each category's label and
description through `categories`. The defaults are plain UK English. All of
it is rendered as text, never as HTML.

## Security

- The stored choice is validated field by field. Anything malformed, too
  long, dated in the future or from another version counts as no choice.
- The cookie is first-party, host-only, `SameSite=Lax`, and `Secure` on HTTPS.
- The head script only ever contains validated numbers and a validated cookie
  name, and takes a CSP `nonce`.
- `policyUrl` must be a site path or an `https` address.
- No dependencies beyond React, and no network requests of its own.

## Developing

```bash
npm install
npm run check   # typecheck, tests, build
```

`dist/` is committed so sites install from GitHub without building. Run
`npm run check` and commit `dist/` with every change.

## Releasing

1. Update `CHANGELOG.md` and the `version` in `package.json`.
2. `npm run check`, commit (including `dist/`).
3. `git tag vX.Y.Z && git push --follow-tags`.
4. In each site, change the tag in `package.json` and reinstall.

A change that alters what a site's visitors agreed to (a new category, new
default wording about purposes) also needs that site's `version` raised.

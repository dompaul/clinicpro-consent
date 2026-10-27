# Changelog

## 1.0.0, 27 October 2026

First release.

- Banner with equal Accept all and Reject all, and a settings dialog by
  category (functional, analytics, marketing; necessary always on).
- Google Consent Mode v2 default and update, from a head script that runs
  before any Google tag.
- `ConsentGate` for trackers, `ConsentEmbed` for embeds that set cookies,
  `CookieSettingsButton`, `useConsent`, `openCookieSettings`.
- Validated first-party cookie, 182-day expiry, `version` to ask again,
  cookie clean-up and a reload on withdrawal, cross-tab sync.
- Server-safe `@clinicpro/consent/head` entry for App Router layouts.

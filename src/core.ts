/* ==========================================================================
   @clinicpro/consent: the rules, with no React
   ==========================================================================
   What a choice is, how it is stored, when it stops counting, and what it
   means for Google's Consent Mode. Everything else in the package is built
   on these functions, and they are the ones the tests pin down.

   The law this follows (UK GDPR and PECR, as the ICO reads them):
   - Nothing that is not strictly necessary is stored or read on the device
     until the person has said yes to it, category by category.
   - Saying no is as easy as saying yes, and no answer means no.
   - A choice can be changed or withdrawn at any time, as easily as it was
     given.
   - A choice is not kept for ever: it lapses (ICO guidance suggests no more
     than a year; this uses six months) and is asked again when what the site
     does with cookies changes (`version`).
   ========================================================================== */

/** The optional categories. "necessary" is not one: it is always on. */
export const CATEGORIES = ["functional", "analytics", "marketing"] as const;
export type Category = (typeof CATEGORIES)[number];

export type Choices = Record<Category, boolean>;

/** What is stored, and what the site reads back. */
export interface ConsentRecord {
  /** The site's consent version when the choice was made. */
  version: number;
  /** When it was made, ISO 8601. */
  date: string;
  choices: Choices;
}

export const DEFAULT_COOKIE_NAME = "site_consent";
export const DEFAULT_MAX_AGE_DAYS = 182;

/** Nothing optional allowed: the state before anyone has chosen. */
export const NONE: Choices = { functional: false, analytics: false, marketing: false };

export const ALL: Choices = { functional: true, analytics: true, marketing: true };

const isRecordLike = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Reads a stored record, or null if it is anything other than exactly what
 * this package writes.
 *
 * The cookie is on the visitor's device and can say anything, so it is
 * validated field by field rather than trusted: an unknown shape, a wrong
 * type, a future date or a missing category all mean "no choice made", which
 * is the safe reading because it grants nothing and asks again.
 */
export function parseRecord(raw: string | null | undefined): ConsentRecord | null {
  if (!raw || raw.length > 512) return null;
  let value: unknown;
  try {
    value = JSON.parse(decodeURIComponent(raw));
  } catch {
    return null;
  }
  if (!isRecordLike(value)) return null;

  const { v, t, c } = value;
  if (typeof v !== "number" || !Number.isInteger(v) || v < 1) return null;
  if (typeof t !== "string" || Number.isNaN(Date.parse(t))) return null;
  if (!isRecordLike(c)) return null;

  const choices = {} as Choices;
  for (const category of CATEGORIES) {
    if (typeof c[category] !== "boolean") return null;
    choices[category] = c[category] as boolean;
  }
  // A date in the future is not a real choice (allowing a day of clock skew).
  if (Date.parse(t) > Date.now() + 86_400_000) return null;

  return { version: v, date: new Date(t).toISOString(), choices };
}

/** The cookie value for a record: short keys, URI-encoded JSON. */
export function serialiseRecord(record: ConsentRecord): string {
  return encodeURIComponent(
    JSON.stringify({ v: record.version, t: record.date, c: record.choices }),
  );
}

/**
 * Whether a stored record still counts: made under the current version and
 * not older than the maximum age. A record that does not count is treated as
 * no choice, and the banner is shown again.
 */
export function isCurrent(
  record: ConsentRecord | null,
  version: number,
  maxAgeDays = DEFAULT_MAX_AGE_DAYS,
  now = Date.now(),
): record is ConsentRecord {
  if (!record || record.version !== version) return false;
  return now - Date.parse(record.date) <= maxAgeDays * 86_400_000;
}

/** The value of one cookie from a `document.cookie` style string. */
export function readCookie(cookieHeader: string | null | undefined, name: string): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const index = part.indexOf("=");
    if (index < 0) continue;
    if (part.slice(0, index).trim() === name) return part.slice(index + 1).trim();
  }
  return null;
}

/**
 * The stored choice from a cookie header, if it still counts. Usable on the
 * server (from the request's Cookie header) as well as in the browser.
 */
export function readConsent(
  cookieHeader: string | null | undefined,
  options: { version: number; cookieName?: string; maxAgeDays?: number },
): ConsentRecord | null {
  const record = parseRecord(readCookie(cookieHeader, options.cookieName ?? DEFAULT_COOKIE_NAME));
  return isCurrent(record, options.version, options.maxAgeDays) ? record : null;
}

/** Google Consent Mode v2 signals for a set of choices. */
export type ConsentModeState = Record<
  | "ad_storage"
  | "ad_user_data"
  | "ad_personalization"
  | "analytics_storage"
  | "functionality_storage"
  | "personalization_storage"
  | "security_storage",
  "granted" | "denied"
>;

export function consentModeState(choices: Choices): ConsentModeState {
  const g = (on: boolean) => (on ? "granted" : "denied");
  return {
    ad_storage: g(choices.marketing),
    ad_user_data: g(choices.marketing),
    ad_personalization: g(choices.marketing),
    analytics_storage: g(choices.analytics),
    functionality_storage: g(choices.functional),
    personalization_storage: g(choices.functional),
    // Fraud prevention and security are strictly necessary.
    security_storage: "granted",
  };
}

/**
 * Cookies that each category is known to set, so withdrawing consent can
 * remove them. A site adds its own through config (`cleanup`).
 */
export const KNOWN_COOKIES: Record<Category, RegExp[]> = {
  functional: [],
  analytics: [/^_ga$/, /^_ga_/, /^_gid$/, /^_gat/, /^_dc_gtm_/, /^_clck$/, /^_clsk$/, /^_hj/],
  marketing: [/^_fbp$/, /^_fbc$/, /^_gcl_/, /^_uet/, /^_ttp$/, /^IDE$/],
};

/** Changing the record is the only thing that should ever change these. */
export const sameChoices = (a: Choices, b: Choices) =>
  CATEGORIES.every((category) => a[category] === b[category]);

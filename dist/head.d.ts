/** The optional categories. "necessary" is not one: it is always on. */
declare const CATEGORIES: readonly ["functional", "analytics", "marketing"];
type Category = (typeof CATEGORIES)[number];
type Choices = Record<Category, boolean>;
/** What is stored, and what the site reads back. */
interface ConsentRecord {
    /** The site's consent version when the choice was made. */
    version: number;
    /** When it was made, ISO 8601. */
    date: string;
    choices: Choices;
}
declare const DEFAULT_COOKIE_NAME = "site_consent";
declare const DEFAULT_MAX_AGE_DAYS = 182;
/** Nothing optional allowed: the state before anyone has chosen. */
declare const NONE: Choices;
declare const ALL: Choices;
/**
 * Reads a stored record, or null if it is anything other than exactly what
 * this package writes.
 *
 * The cookie is on the visitor's device and can say anything, so it is
 * validated field by field rather than trusted: an unknown shape, a wrong
 * type, a future date or a missing category all mean "no choice made", which
 * is the safe reading because it grants nothing and asks again.
 */
declare function parseRecord(raw: string | null | undefined): ConsentRecord | null;
/** The cookie value for a record: short keys, URI-encoded JSON. */
declare function serialiseRecord(record: ConsentRecord): string;
/**
 * Whether a stored record still counts: made under the current version and
 * not older than the maximum age. A record that does not count is treated as
 * no choice, and the banner is shown again.
 */
declare function isCurrent(record: ConsentRecord | null, version: number, maxAgeDays?: number, now?: number): record is ConsentRecord;
/** The value of one cookie from a `document.cookie` style string. */
declare function readCookie(cookieHeader: string | null | undefined, name: string): string | null;
/**
 * The stored choice from a cookie header, if it still counts. Usable on the
 * server (from the request's Cookie header) as well as in the browser.
 */
declare function readConsent(cookieHeader: string | null | undefined, options: {
    version: number;
    cookieName?: string;
    maxAgeDays?: number;
}): ConsentRecord | null;
/** Google Consent Mode v2 signals for a set of choices. */
type ConsentModeState = Record<"ad_storage" | "ad_user_data" | "ad_personalization" | "analytics_storage" | "functionality_storage" | "personalization_storage" | "security_storage", "granted" | "denied">;
declare function consentModeState(choices: Choices): ConsentModeState;
/**
 * Cookies that each category is known to set, so withdrawing consent can
 * remove them. A site adds its own through config (`cleanup`).
 */
declare const KNOWN_COOKIES: Record<Category, RegExp[]>;
/** Changing the record is the only thing that should ever change these. */
declare const sameChoices: (a: Choices, b: Choices) => boolean;

interface HeadScriptOptions {
    /** The site's consent version (ConsentConfig.version). */
    version: number;
    cookieName?: string;
    maxAgeDays?: number;
    /** Milliseconds Google tags wait for an update before using the default. */
    waitForUpdate?: number;
}
/**
 * The inline script's source. Put it in a <script> as the first thing in
 * <head>, before Google Tag Manager or gtag.js (see <ConsentHeadScript> in
 * the main entry, or set it yourself with a CSP nonce).
 *
 * It mirrors parseRecord/isCurrent/consentModeState in core.ts; the tests run
 * it against the same cases so the two cannot drift.
 */
declare function consentModeScript(options: HeadScriptOptions): string;

export { ALL, CATEGORIES, type Category, type Choices, type ConsentModeState, type ConsentRecord, DEFAULT_COOKIE_NAME, DEFAULT_MAX_AGE_DAYS, type HeadScriptOptions, KNOWN_COOKIES, NONE, consentModeScript, consentModeState, isCurrent, parseRecord, readConsent, readCookie, sameChoices, serialiseRecord };

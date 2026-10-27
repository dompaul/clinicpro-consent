import * as React from 'react';

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

interface CategoryCopy {
    label: string;
    description: string;
    /** Cookies to delete when this category is withdrawn, beyond KNOWN_COOKIES. */
    cookies?: (string | RegExp)[];
}
interface ConsentStrings {
    bannerTitle: string;
    /** Before the list of purposes. */
    bannerIntro: string;
    acceptAll: string;
    rejectAll: string;
    manage: string;
    policyLink: string;
    settingsTitle: string;
    settingsIntro: string;
    necessaryLabel: string;
    necessaryDescription: string;
    alwaysOn: string;
    save: string;
    close: string;
    /** Purposes listed in the banner, one per category the site uses. */
    purposes: Record<Category, string>;
    /** Embed placeholder. {provider} and {what} are filled in, as text. */
    embedTitle: string;
    embedText: string;
    embedLoad: string;
    embedAlways: string;
}
interface ConsentConfig {
    /**
     * Raise this whenever what the site does with cookies changes (a new
     * tracker, a new purpose). Everyone is asked again.
     */
    version: number;
    /** The categories this site uses, with their wording. Unlisted ones are never offered or granted. */
    categories: Partial<Record<Category, Partial<CategoryCopy>>>;
    /** The cookie policy: a path on this site ("/cookie-policy") or an https address. */
    policyUrl: string;
    cookieName?: string;
    /** How long a choice lasts before it is asked again. Default 182 days. */
    maxAgeDays?: number;
    strings?: Partial<Omit<ConsentStrings, "purposes">> & {
        purposes?: Partial<Record<Category, string>>;
    };
    /** Paths where the banner never shows (an admin area). The gates still apply. */
    exclude?: RegExp;
    /**
     * Reload once after a category that had been allowed is withdrawn, so
     * scripts that already ran stop. Default true.
     */
    reloadOnWithdraw?: boolean;
    /** Called after every saved choice, for a site that keeps its own record. */
    onChange?: (record: ConsentRecord, source: ConsentSource) => void;
}
type ConsentSource = "banner" | "settings" | "embed" | "api";
interface ConsentState {
    /** False until the stored choice has been read in the browser. Gates stay shut until then. */
    ready: boolean;
    /** The current choice, or null if none has been made (or it lapsed). */
    record: ConsentRecord | null;
    /** What is allowed now: NONE until someone chooses. */
    choices: Choices;
    /** The categories this site uses. */
    categories: Category[];
    granted: (category: Category) => boolean;
    acceptAll: (source?: ConsentSource) => void;
    rejectAll: (source?: ConsentSource) => void;
    save: (choices: Partial<Choices>, source?: ConsentSource) => void;
    openSettings: () => void;
    /** The site's wording, for the package's own components. */
    strings: ConsentStrings;
}
declare function useConsent(): ConsentState;
/** Opens the settings dialog from anywhere, including non-React code. */
declare function openCookieSettings(): void;
declare function ConsentProvider({ config, pathname, children, }: {
    config: ConsentConfig;
    /**
     * The current path, for `exclude`: useRouter().pathname (Pages Router) or
     * usePathname() (App Router). Without it the path is read once on load.
     */
    pathname?: string;
    children?: React.ReactNode;
}): React.JSX.Element;
/**
 * Renders its children only once `category` is allowed: put tracking
 * <Script>s inside. Nothing renders on the server or before the stored choice
 * is read, so a tracker can never load ahead of the decision.
 */
declare function ConsentGate({ category, children, fallback, }: {
    category: Category;
    children: React.ReactNode;
    fallback?: React.ReactNode;
}): React.JSX.Element;
/**
 * A third-party embed (a map, a video) that sets cookies when it loads.
 * Until its category is allowed it shows a placeholder in the same box, with
 * a button to load it once and one to allow it from now on.
 */
declare function ConsentEmbed({ category, provider, what, className, style, children, }: {
    category?: Category;
    /** Who it comes from: "Google Maps". */
    provider: string;
    /** What it is, for the buttons: "map". */
    what: string;
    className?: string;
    style?: React.CSSProperties;
    children: React.ReactNode;
}): React.JSX.Element;
/** A button that opens the settings: put one in the site footer. */
declare function CookieSettingsButton({ className, children, }: {
    className?: string;
    children?: React.ReactNode;
}): React.JSX.Element;
/**
 * The head script as an element, for a Pages Router _document <Head> (put it
 * first). App Router layouts call consentModeScript() from
 * "@clinicpro/consent/head" in a server component instead.
 */
declare function ConsentHeadScript({ nonce, ...options }: HeadScriptOptions & {
    nonce?: string;
}): React.JSX.Element;

export { ALL, CATEGORIES, type Category, type CategoryCopy, type Choices, type ConsentConfig, ConsentEmbed, ConsentGate, ConsentHeadScript, type ConsentModeState, ConsentProvider, type ConsentRecord, type ConsentSource, type ConsentState, type ConsentStrings, CookieSettingsButton, DEFAULT_COOKIE_NAME, DEFAULT_MAX_AGE_DAYS, type HeadScriptOptions, KNOWN_COOKIES, NONE, consentModeScript, consentModeState, isCurrent, openCookieSettings, parseRecord, readConsent, readCookie, sameChoices, serialiseRecord, useConsent };

import * as React from "react";

import {
  ALL,
  CATEGORIES,
  Category,
  Choices,
  ConsentRecord,
  DEFAULT_COOKIE_NAME,
  DEFAULT_MAX_AGE_DAYS,
  KNOWN_COOKIES,
  NONE,
  consentModeState,
  isCurrent,
  parseRecord,
  readCookie,
  sameChoices,
  serialiseRecord,
} from "./core";
import { consentModeScript, HeadScriptOptions } from "./head";

export * from "./core";
export { consentModeScript } from "./head";
export type { HeadScriptOptions } from "./head";

/* ==========================================================================
   @clinicpro/consent: the banner, the settings, and the gates
   ==========================================================================
   <ConsentProvider> wraps the app once. It shows the banner to anyone who
   has not chosen, holds the settings dialog, and tells everything else what
   is allowed. Trackers go inside <ConsentGate>, third-party embeds inside
   <ConsentEmbed>, and nothing optional runs until it is allowed.

   Text from config is only ever rendered as text, never as HTML.
   ========================================================================== */

export interface CategoryCopy {
  label: string;
  description: string;
  /** Cookies to delete when this category is withdrawn, beyond KNOWN_COOKIES. */
  cookies?: (string | RegExp)[];
}

export interface ConsentStrings {
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

export interface ConsentConfig {
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
  strings?: Partial<Omit<ConsentStrings, "purposes">> & { purposes?: Partial<Record<Category, string>> };
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

export type ConsentSource = "banner" | "settings" | "embed" | "api";

const DEFAULT_COPY: Record<Category, CategoryCopy> = {
  functional: {
    label: "Functional",
    description:
      "Load content from other services, such as maps from Google Maps. Those services set their own cookies when their content loads.",
  },
  analytics: {
    label: "Analytics",
    description:
      "Count visits and see which pages are used, so we can improve the site. We use Google Analytics for this.",
  },
  marketing: {
    label: "Marketing",
    description: "Measure how our advertising performs and show relevant adverts on other sites.",
  },
};

const DEFAULT_STRINGS: ConsentStrings = {
  bannerTitle: "Cookies on this site",
  bannerIntro:
    "We use necessary cookies to make this site work. With your permission we would also like to",
  acceptAll: "Accept all",
  rejectAll: "Reject all",
  manage: "Manage cookies",
  policyLink: "Cookie policy",
  settingsTitle: "Cookie settings",
  settingsIntro:
    "Choose which optional cookies we may use. You can change this at any time from Cookie settings at the foot of every page.",
  necessaryLabel: "Necessary",
  necessaryDescription:
    "Keep the site working and secure, for example protecting forms from spam and remembering your cookie choice.",
  alwaysOn: "Always on",
  save: "Save my choices",
  close: "Close",
  purposes: {
    functional: "load maps and other content from other services",
    analytics: "measure how the site is used",
    marketing: "measure our advertising",
  },
  embedTitle: "{provider} is not loaded",
  embedText: "{provider} sets cookies when it loads, so it waits for your permission.",
  embedLoad: "Load this {what}",
  embedAlways: "Always load {provider}",
};

/** Fills {provider} and {what}. The result is only ever rendered as text. */
const fill = (template: string, values: Record<string, string>) =>
  template.replace(/\{(provider|what)\}/g, (_, key: string) => values[key] ?? "");

/** "a", "a and b", "a, b and c" */
const listOf = (items: string[]) =>
  items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;

const SAFE_URL = /^(\/(?!\/)|https:\/\/)/;

const BROADCAST = "clinicpro-consent";

// ---------------------------------------------------------------------------
// Cookie writing (browser only)

function writeCookie(name: string, value: string, maxAgeDays: number) {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  // Host-only (no Domain attribute): the choice belongs to this site alone.
  document.cookie = `${name}=${value}; Path=/; Max-Age=${maxAgeDays * 86_400}; SameSite=Lax${secure}`;
}

/** Deletes cookies matching the patterns, on this host and every parent domain. */
function deleteCookies(patterns: (string | RegExp)[]) {
  if (!patterns.length) return;
  const names = document.cookie
    .split(";")
    .map((part) => part.split("=")[0].trim())
    .filter(Boolean);
  const matches = names.filter((name) =>
    patterns.some((p) => (typeof p === "string" ? p === name : p.test(name))),
  );
  if (!matches.length) return;
  const host = window.location.hostname;
  const parts = host.split(".");
  const domains = [""];
  for (let i = 0; i < parts.length - 1; i += 1) domains.push(`; Domain=.${parts.slice(i).join(".")}`);
  for (const name of matches) {
    for (const domain of domains) {
      document.cookie = `${name}=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT${domain}`;
    }
  }
}

type Gtag = (...args: unknown[]) => void;

function pushConsentMode(choices: Choices) {
  const w = window as unknown as { gtag?: Gtag; dataLayer?: unknown[] };
  w.dataLayer = w.dataLayer || [];
  if (typeof w.gtag !== "function") {
    w.gtag = function gtag() {
      // eslint-disable-next-line prefer-rest-params
      w.dataLayer!.push(arguments);
    };
  }
  w.gtag("consent", "update", consentModeState(choices));
  // A plain event as well, for GTM triggers that wait on the choice.
  w.dataLayer.push({ event: "consent_update", consent: { ...choices } });
}

// ---------------------------------------------------------------------------
// Context

export interface ConsentState {
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

const ConsentContext = React.createContext<ConsentState | null>(null);

export function useConsent(): ConsentState {
  const value = React.useContext(ConsentContext);
  if (!value) throw new Error("useConsent must be used inside <ConsentProvider>");
  return value;
}

/** Opens the settings dialog from anywhere, including non-React code. */
export function openCookieSettings() {
  window.dispatchEvent(new Event("clinicpro-consent:open"));
}

// ---------------------------------------------------------------------------
// Provider

export function ConsentProvider({
  config,
  pathname,
  children,
}: {
  config: ConsentConfig;
  /**
   * The current path, for `exclude`: useRouter().pathname (Pages Router) or
   * usePathname() (App Router). Without it the path is read once on load.
   */
  pathname?: string;
  children?: React.ReactNode;
}) {
  const cookieName = config.cookieName ?? DEFAULT_COOKIE_NAME;
  const maxAgeDays = config.maxAgeDays ?? DEFAULT_MAX_AGE_DAYS;
  const reloadOnWithdraw = config.reloadOnWithdraw ?? true;

  // A config mistake fails loudly in development. In production it is logged
  // and the safe reading is used, rather than taking the whole site down.
  const policyUrl = React.useMemo(() => {
    const problems: string[] = [];
    try {
      consentModeScript({ version: config.version, cookieName, maxAgeDays });
    } catch (error) {
      problems.push((error as Error).message);
    }
    const safe = SAFE_URL.test(config.policyUrl);
    if (!safe) problems.push("@clinicpro/consent: policyUrl must be a site path or an https address");
    if (problems.length) {
      const production = typeof process !== "undefined" && process.env?.NODE_ENV === "production";
      if (!production) throw new Error(problems.join("\n"));
      console.error(problems.join("\n"));
    }
    return safe ? config.policyUrl : null;
  }, [config.version, config.policyUrl, cookieName, maxAgeDays]);

  // Keyed on what the config says rather than on the object, so a config
  // written inline (a new object every render) does not re-render the site.
  const categoryKey = CATEGORIES.filter((category) => config.categories[category]).join(",");
  const categories = React.useMemo(
    () => (categoryKey ? (categoryKey.split(",") as Category[]) : []),
    [categoryKey],
  );
  const configRef = React.useRef(config);
  configRef.current = config;

  const [ready, setReady] = React.useState(false);
  const [record, setRecord] = React.useState<ConsentRecord | null>(null);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [loadPath, setLoadPath] = React.useState("");
  const recordRef = React.useRef(record);
  recordRef.current = record;
  const channel = React.useRef<BroadcastChannel | null>(null);

  const readStored = React.useCallback(() => {
    const stored = parseRecord(readCookie(document.cookie, cookieName));
    return isCurrent(stored, config.version, maxAgeDays) ? stored : null;
  }, [cookieName, config.version, maxAgeDays]);

  // Read the stored choice once in the browser, then keep it in step with
  // other tabs (BroadcastChannel) and with a tab coming back into view.
  React.useEffect(() => {
    setRecord(readStored());
    setLoadPath(window.location.pathname);
    setReady(true);

    // Another tab changed the choice: follow it, and reload if it withdrew
    // something this tab may already be running.
    const sync = () => {
      const next = readStored();
      const current = recordRef.current;
      if (!next && !current) return;
      if (next && current && next.date === current.date) return;
      setRecord(next);
      const after = next?.choices ?? NONE;
      pushConsentMode(after);
      const before = current?.choices ?? NONE;
      if (reloadOnWithdraw && CATEGORIES.some((category) => before[category] && !after[category])) {
        window.location.reload();
      }
    };

    if (typeof BroadcastChannel !== "undefined") {
      channel.current = new BroadcastChannel(BROADCAST);
      channel.current.onmessage = sync;
    }
    const onVisible = () => {
      if (document.visibilityState === "visible") sync();
    };
    document.addEventListener("visibilitychange", onVisible);
    const onOpen = () => setSettingsOpen(true);
    window.addEventListener("clinicpro-consent:open", onOpen);
    return () => {
      channel.current?.close();
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("clinicpro-consent:open", onOpen);
    };
  }, [readStored, reloadOnWithdraw]);

  const save = React.useCallback(
    (wanted: Partial<Choices>, source: ConsentSource = "api") => {
      const choices = { ...NONE };
      for (const category of categories) choices[category] = Boolean(wanted[category]);

      const previous = recordRef.current?.choices ?? NONE;
      const current = configRef.current;
      const next: ConsentRecord = { version: current.version, date: new Date().toISOString(), choices };
      writeCookie(cookieName, serialiseRecord(next), maxAgeDays);
      setRecord(next);
      setSettingsOpen(false);
      pushConsentMode(choices);

      const withdrawn = categories.filter((category) => previous[category] && !choices[category]);
      for (const category of withdrawn) {
        deleteCookies([...KNOWN_COOKIES[category], ...(current.categories[category]?.cookies ?? [])]);
      }

      channel.current?.postMessage("changed");
      window.dispatchEvent(new CustomEvent("clinicpro-consent:change", { detail: next }));
      try {
        current.onChange?.(next, source);
      } catch (error) {
        console.error("@clinicpro/consent: onChange failed", error);
      }

      // Scripts that already ran under the old choice keep running until the
      // page is gone, so a withdrawal reloads once.
      if (withdrawn.length && reloadOnWithdraw && !sameChoices(previous, choices)) {
        window.setTimeout(() => window.location.reload(), 50);
      }
    },
    [categories, cookieName, maxAgeDays, reloadOnWithdraw],
  );

  const stringsKey = JSON.stringify(config.strings ?? null);
  const strings = React.useMemo<ConsentStrings>(
    () => ({
      ...DEFAULT_STRINGS,
      ...configRef.current.strings,
      purposes: { ...DEFAULT_STRINGS.purposes, ...configRef.current.strings?.purposes },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stringsKey],
  );

  const value = React.useMemo<ConsentState>(() => {
    const choices = record?.choices ?? NONE;
    return {
      ready,
      record,
      choices,
      categories,
      granted: (category) => ready && choices[category] === true,
      acceptAll: (source = "api") => save(ALL, source),
      rejectAll: (source = "api") => save(NONE, source),
      save,
      openSettings: () => setSettingsOpen(true),
      strings,
    };
  }, [ready, record, categories, save, strings]);
  const copy = (category: Category): CategoryCopy => ({
    ...DEFAULT_COPY[category],
    ...config.categories[category],
  });

  const path = pathname ?? loadPath;
  const excluded = Boolean(config.exclude && path && config.exclude.test(path));
  // Hidden while the settings are open: the dialog asks the same question.
  const showBanner = ready && !record && !excluded && categories.length > 0 && !settingsOpen;

  return (
    <ConsentContext.Provider value={value}>
      {showBanner && (
        <Banner
          strings={strings}
          purposes={categories.map((category) => strings.purposes[category])}
          policyUrl={policyUrl}
          onAccept={() => save(ALL, "banner")}
          onReject={() => save(NONE, "banner")}
          onManage={() => setSettingsOpen(true)}
        />
      )}
      {children}
      {ready && settingsOpen && (
        <Settings
          strings={strings}
          categories={categories}
          copy={copy}
          current={record?.choices ?? NONE}
          policyUrl={policyUrl}
          onSave={(choices) => save(choices, "settings")}
          onAccept={() => save(ALL, "settings")}
          onReject={() => save(NONE, "settings")}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </ConsentContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Banner

function Banner({
  strings,
  purposes,
  policyUrl,
  onAccept,
  onReject,
  onManage,
}: {
  strings: ConsentStrings;
  purposes: string[];
  policyUrl: string | null;
  onAccept: () => void;
  onReject: () => void;
  onManage: () => void;
}) {
  const titleId = React.useId();
  return (
    <section className="cpc-banner" role="region" aria-labelledby={titleId}>
      <h2 id={titleId} className="cpc-title">
        {strings.bannerTitle}
      </h2>
      <p className="cpc-text">
        {strings.bannerIntro} {listOf(purposes)}.
        {policyUrl && (
          <>
            {" "}
            <a className="cpc-link" href={policyUrl}>
              {strings.policyLink}
            </a>
          </>
        )}
      </p>
      <div className="cpc-buttons">
        {/* Same look for both: saying no is as easy as saying yes. */}
        <button type="button" className="cpc-button cpc-primary" onClick={onAccept}>
          {strings.acceptAll}
        </button>
        <button type="button" className="cpc-button cpc-primary" onClick={onReject}>
          {strings.rejectAll}
        </button>
        <button type="button" className="cpc-button cpc-secondary" onClick={onManage}>
          {strings.manage}
        </button>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Settings dialog

function Settings({
  strings,
  categories,
  copy,
  current,
  policyUrl,
  onSave,
  onAccept,
  onReject,
  onClose,
}: {
  strings: ConsentStrings;
  categories: Category[];
  copy: (category: Category) => CategoryCopy;
  current: Choices;
  policyUrl: string | null;
  onSave: (choices: Choices) => void;
  onAccept: () => void;
  onReject: () => void;
  onClose: () => void;
}) {
  const ref = React.useRef<HTMLDialogElement>(null);
  const titleId = React.useId();
  const [draft, setDraft] = React.useState<Choices>(current);

  // The native modal dialog: it traps focus, closes on Escape, makes the page
  // behind it inert, and returns focus to whatever opened it.
  React.useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    const root = document.documentElement;
    const body = document.body;
    const previous = [root.style.overflow, body.style.overflow];
    root.style.overflow = "hidden";
    body.style.overflow = "hidden";
    return () => {
      root.style.overflow = previous[0];
      body.style.overflow = previous[1];
      if (dialog.open) dialog.close();
    };
  }, []);

  return (
    <dialog
      ref={ref}
      className="cpc-dialog"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        // A click on the backdrop lands on the dialog element itself.
        if (event.target === ref.current) onClose();
      }}
    >
      <div className="cpc-dialog-body">
        <div className="cpc-dialog-head">
          <h2 id={titleId} className="cpc-title">
            {strings.settingsTitle}
          </h2>
          <button type="button" className="cpc-close" onClick={onClose} aria-label={strings.close}>
            <span aria-hidden>×</span>
          </button>
        </div>
        <p className="cpc-text">
          {strings.settingsIntro}
          {policyUrl && (
            <>
              {" "}
              <a className="cpc-link" href={policyUrl}>
                {strings.policyLink}
              </a>
            </>
          )}
        </p>

        <ul className="cpc-list">
          <li className="cpc-item">
            <div className="cpc-item-text">
              <span className="cpc-item-label">{strings.necessaryLabel}</span>
              <span className="cpc-item-description">{strings.necessaryDescription}</span>
            </div>
            <span className="cpc-always">{strings.alwaysOn}</span>
          </li>
          {categories.map((category) => {
            const { label, description } = copy(category);
            const id = `cpc-${category}`;
            return (
              <li key={category} className="cpc-item">
                <div className="cpc-item-text">
                  <label className="cpc-item-label" htmlFor={id}>
                    {label}
                  </label>
                  <span className="cpc-item-description" id={`${id}-description`}>
                    {description}
                  </span>
                </div>
                <input
                  id={id}
                  type="checkbox"
                  role="switch"
                  className="cpc-switch"
                  checked={draft[category]}
                  aria-describedby={`${id}-description`}
                  onChange={(event) => setDraft({ ...draft, [category]: event.target.checked })}
                />
              </li>
            );
          })}
        </ul>

        <div className="cpc-buttons">
          <button type="button" className="cpc-button cpc-primary" onClick={() => onSave(draft)}>
            {strings.save}
          </button>
          <button type="button" className="cpc-button cpc-secondary" onClick={onAccept}>
            {strings.acceptAll}
          </button>
          <button type="button" className="cpc-button cpc-secondary" onClick={onReject}>
            {strings.rejectAll}
          </button>
        </div>
      </div>
    </dialog>
  );
}

// ---------------------------------------------------------------------------
// Gates

/**
 * Renders its children only once `category` is allowed: put tracking
 * <Script>s inside. Nothing renders on the server or before the stored choice
 * is read, so a tracker can never load ahead of the decision.
 */
export function ConsentGate({
  category,
  children,
  fallback = null,
}: {
  category: Category;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { granted } = useConsent();
  return <>{granted(category) ? children : fallback}</>;
}

/**
 * A third-party embed (a map, a video) that sets cookies when it loads.
 * Until its category is allowed it shows a placeholder in the same box, with
 * a button to load it once and one to allow it from now on.
 */
export function ConsentEmbed({
  category = "functional",
  provider,
  what,
  className,
  style,
  children,
}: {
  category?: Category;
  /** Who it comes from: "Google Maps". */
  provider: string;
  /** What it is, for the buttons: "map". */
  what: string;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  const { granted, choices, save, ready, strings } = useConsent();
  const [once, setOnce] = React.useState(false);

  if (ready && (granted(category) || once)) return <>{children}</>;

  const values = { provider, what };
  return (
    <div className={["cpc-embed", className].filter(Boolean).join(" ")} style={style}>
      <div className="cpc-embed-body">
        <p className="cpc-embed-title">{fill(strings.embedTitle, values)}</p>
        <p className="cpc-embed-text">{fill(strings.embedText, values)}</p>
        <div className="cpc-buttons">
          <button
            type="button"
            className="cpc-button cpc-primary"
            onClick={() => setOnce(true)}
            disabled={!ready}
          >
            {fill(strings.embedLoad, values)}
          </button>
          <button
            type="button"
            className="cpc-button cpc-secondary"
            onClick={() => save({ ...choices, [category]: true }, "embed")}
            disabled={!ready}
          >
            {fill(strings.embedAlways, values)}
          </button>
        </div>
      </div>
    </div>
  );
}

/** A button that opens the settings: put one in the site footer. */
export function CookieSettingsButton({
  className,
  children = "Cookie settings",
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <button type="button" className={className} onClick={openCookieSettings}>
      {children}
    </button>
  );
}

/**
 * The head script as an element, for a Pages Router _document <Head> (put it
 * first). App Router layouts call consentModeScript() from
 * "@clinicpro/consent/head" in a server component instead.
 */
export function ConsentHeadScript({ nonce, ...options }: HeadScriptOptions & { nonce?: string }) {
  return (
    <script
      id="clinicpro-consent-default"
      nonce={nonce}
      dangerouslySetInnerHTML={{ __html: consentModeScript(options) }}
    />
  );
}

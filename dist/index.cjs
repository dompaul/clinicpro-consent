"use client";
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.tsx
var src_exports = {};
__export(src_exports, {
  ALL: () => ALL,
  CATEGORIES: () => CATEGORIES,
  ConsentEmbed: () => ConsentEmbed,
  ConsentGate: () => ConsentGate,
  ConsentHeadScript: () => ConsentHeadScript,
  ConsentProvider: () => ConsentProvider,
  CookieSettingsButton: () => CookieSettingsButton,
  DEFAULT_COOKIE_NAME: () => DEFAULT_COOKIE_NAME,
  DEFAULT_MAX_AGE_DAYS: () => DEFAULT_MAX_AGE_DAYS,
  KNOWN_COOKIES: () => KNOWN_COOKIES,
  NONE: () => NONE,
  consentModeScript: () => consentModeScript,
  consentModeState: () => consentModeState,
  isCurrent: () => isCurrent,
  openCookieSettings: () => openCookieSettings,
  parseRecord: () => parseRecord,
  readConsent: () => readConsent,
  readCookie: () => readCookie,
  sameChoices: () => sameChoices,
  serialiseRecord: () => serialiseRecord,
  useConsent: () => useConsent
});
module.exports = __toCommonJS(src_exports);
var React = __toESM(require("react"), 1);

// src/core.ts
var CATEGORIES = ["functional", "analytics", "marketing"];
var DEFAULT_COOKIE_NAME = "site_consent";
var DEFAULT_MAX_AGE_DAYS = 182;
var NONE = { functional: false, analytics: false, marketing: false };
var ALL = { functional: true, analytics: true, marketing: true };
var isRecordLike = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
function parseRecord(raw) {
  if (!raw || raw.length > 512) return null;
  let value;
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
  const choices = {};
  for (const category of CATEGORIES) {
    if (typeof c[category] !== "boolean") return null;
    choices[category] = c[category];
  }
  if (Date.parse(t) > Date.now() + 864e5) return null;
  return { version: v, date: new Date(t).toISOString(), choices };
}
function serialiseRecord(record) {
  return encodeURIComponent(
    JSON.stringify({ v: record.version, t: record.date, c: record.choices })
  );
}
function isCurrent(record, version, maxAgeDays = DEFAULT_MAX_AGE_DAYS, now = Date.now()) {
  if (!record || record.version !== version) return false;
  return now - Date.parse(record.date) <= maxAgeDays * 864e5;
}
function readCookie(cookieHeader, name) {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const index = part.indexOf("=");
    if (index < 0) continue;
    if (part.slice(0, index).trim() === name) return part.slice(index + 1).trim();
  }
  return null;
}
function readConsent(cookieHeader, options) {
  const record = parseRecord(readCookie(cookieHeader, options.cookieName ?? DEFAULT_COOKIE_NAME));
  return isCurrent(record, options.version, options.maxAgeDays) ? record : null;
}
function consentModeState(choices) {
  const g = (on) => on ? "granted" : "denied";
  return {
    ad_storage: g(choices.marketing),
    ad_user_data: g(choices.marketing),
    ad_personalization: g(choices.marketing),
    analytics_storage: g(choices.analytics),
    functionality_storage: g(choices.functional),
    personalization_storage: g(choices.functional),
    // Fraud prevention and security are strictly necessary.
    security_storage: "granted"
  };
}
var KNOWN_COOKIES = {
  functional: [],
  analytics: [/^_ga$/, /^_ga_/, /^_gid$/, /^_gat/, /^_dc_gtm_/, /^_clck$/, /^_clsk$/, /^_hj/],
  marketing: [/^_fbp$/, /^_fbc$/, /^_gcl_/, /^_uet/, /^_ttp$/, /^IDE$/]
};
var sameChoices = (a, b) => CATEGORIES.every((category) => a[category] === b[category]);

// src/head.ts
var COOKIE_NAME = /^[A-Za-z0-9_-]{1,64}$/;
function check(options) {
  const cookieName = options.cookieName ?? DEFAULT_COOKIE_NAME;
  const maxAgeDays = options.maxAgeDays ?? DEFAULT_MAX_AGE_DAYS;
  const waitForUpdate = options.waitForUpdate ?? 500;
  if (!Number.isInteger(options.version) || options.version < 1) {
    throw new Error("@clinicpro/consent: version must be a whole number from 1");
  }
  if (!COOKIE_NAME.test(cookieName)) {
    throw new Error("@clinicpro/consent: cookieName may only use letters, digits, _ and -");
  }
  if (!Number.isInteger(maxAgeDays) || maxAgeDays < 1 || maxAgeDays > 395) {
    throw new Error("@clinicpro/consent: maxAgeDays must be a whole number from 1 to 395");
  }
  if (!Number.isInteger(waitForUpdate) || waitForUpdate < 0 || waitForUpdate > 1e4) {
    throw new Error("@clinicpro/consent: waitForUpdate must be 0 to 10000");
  }
  return { version: options.version, cookieName, maxAgeDays, waitForUpdate };
}
function consentModeScript(options) {
  const { version, cookieName, maxAgeDays, waitForUpdate } = check(options);
  return `(function(){
var w=window;w.dataLayer=w.dataLayer||[];
if(typeof w.gtag!=="function"){w.gtag=function(){w.dataLayer.push(arguments);};}
var D="denied",G="granted";
w.gtag("consent","default",{ad_storage:D,ad_user_data:D,ad_personalization:D,analytics_storage:D,functionality_storage:D,personalization_storage:D,security_storage:G,wait_for_update:${waitForUpdate}});
try{
var m=document.cookie.match(/(?:^|;\\s*)${cookieName}=([^;]*)/);if(!m||m[1].length>512)return;
var r=JSON.parse(decodeURIComponent(m[1]));if(!r||r.v!==${version}||typeof r.t!=="string")return;
var t=Date.parse(r.t);if(isNaN(t)||Date.now()-t>${maxAgeDays * 864e5}||t>Date.now()+86400000)return;
var c=r.c;if(!c||typeof c.functional!=="boolean"||typeof c.analytics!=="boolean"||typeof c.marketing!=="boolean")return;
var g=function(b){return b?G:D;};
w.gtag("consent","update",{ad_storage:g(c.marketing),ad_user_data:g(c.marketing),ad_personalization:g(c.marketing),analytics_storage:g(c.analytics),functionality_storage:g(c.functional),personalization_storage:g(c.functional),security_storage:G});
}catch(e){}
})();`;
}

// src/index.tsx
var import_jsx_runtime = require("react/jsx-runtime");
var DEFAULT_COPY = {
  functional: {
    label: "Functional",
    description: "Load content from other services, such as maps from Google Maps. Those services set their own cookies when their content loads."
  },
  analytics: {
    label: "Analytics",
    description: "Count visits and see which pages are used, so we can improve the site. We use Google Analytics for this."
  },
  marketing: {
    label: "Marketing",
    description: "Measure how our advertising performs and show relevant adverts on other sites."
  }
};
var DEFAULT_STRINGS = {
  bannerTitle: "Cookies on this site",
  bannerIntro: "We use necessary cookies to make this site work. With your permission we would also like to",
  acceptAll: "Accept all",
  rejectAll: "Reject all",
  manage: "Manage cookies",
  policyLink: "Cookie policy",
  settingsTitle: "Cookie settings",
  settingsIntro: "Choose which optional cookies we may use. You can change this at any time from Cookie settings at the foot of every page.",
  necessaryLabel: "Necessary",
  necessaryDescription: "Keep the site working and secure, for example protecting forms from spam and remembering your cookie choice.",
  alwaysOn: "Always on",
  save: "Save my choices",
  close: "Close",
  purposes: {
    functional: "load maps and other content from other services",
    analytics: "measure how the site is used",
    marketing: "measure our advertising"
  },
  embedTitle: "{provider} is not loaded",
  embedText: "{provider} sets cookies when it loads, so it waits for your permission.",
  embedLoad: "Load this {what}",
  embedAlways: "Always load {provider}"
};
var fill = (template, values) => template.replace(/\{(provider|what)\}/g, (_, key) => values[key] ?? "");
var listOf = (items) => items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
var SAFE_URL = /^(\/(?!\/)|https:\/\/)/;
var BROADCAST = "clinicpro-consent";
function writeCookie(name, value, maxAgeDays) {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${value}; Path=/; Max-Age=${maxAgeDays * 86400}; SameSite=Lax${secure}`;
}
function deleteCookies(patterns) {
  if (!patterns.length) return;
  const names = document.cookie.split(";").map((part) => part.split("=")[0].trim()).filter(Boolean);
  const matches = names.filter(
    (name) => patterns.some((p) => typeof p === "string" ? p === name : p.test(name))
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
function pushConsentMode(choices) {
  const w = window;
  w.dataLayer = w.dataLayer || [];
  if (typeof w.gtag !== "function") {
    w.gtag = function gtag() {
      w.dataLayer.push(arguments);
    };
  }
  w.gtag("consent", "update", consentModeState(choices));
  w.dataLayer.push({ event: "consent_update", consent: { ...choices } });
}
var ConsentContext = React.createContext(null);
function useConsent() {
  const value = React.useContext(ConsentContext);
  if (!value) throw new Error("useConsent must be used inside <ConsentProvider>");
  return value;
}
function openCookieSettings() {
  window.dispatchEvent(new Event("clinicpro-consent:open"));
}
function ConsentProvider({
  config,
  pathname,
  children
}) {
  const cookieName = config.cookieName ?? DEFAULT_COOKIE_NAME;
  const maxAgeDays = config.maxAgeDays ?? DEFAULT_MAX_AGE_DAYS;
  const reloadOnWithdraw = config.reloadOnWithdraw ?? true;
  const policyUrl = React.useMemo(() => {
    const problems = [];
    try {
      consentModeScript({ version: config.version, cookieName, maxAgeDays });
    } catch (error) {
      problems.push(error.message);
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
  const categoryKey = CATEGORIES.filter((category) => config.categories[category]).join(",");
  const categories = React.useMemo(
    () => categoryKey ? categoryKey.split(",") : [],
    [categoryKey]
  );
  const configRef = React.useRef(config);
  configRef.current = config;
  const [ready, setReady] = React.useState(false);
  const [record, setRecord] = React.useState(null);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [loadPath, setLoadPath] = React.useState("");
  const recordRef = React.useRef(record);
  recordRef.current = record;
  const channel = React.useRef(null);
  const readStored = React.useCallback(() => {
    const stored = parseRecord(readCookie(document.cookie, cookieName));
    return isCurrent(stored, config.version, maxAgeDays) ? stored : null;
  }, [cookieName, config.version, maxAgeDays]);
  React.useEffect(() => {
    setRecord(readStored());
    setLoadPath(window.location.pathname);
    setReady(true);
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
    (wanted, source = "api") => {
      const choices = { ...NONE };
      for (const category of categories) choices[category] = Boolean(wanted[category]);
      const previous = recordRef.current?.choices ?? NONE;
      const current = configRef.current;
      const next = { version: current.version, date: (/* @__PURE__ */ new Date()).toISOString(), choices };
      writeCookie(cookieName, serialiseRecord(next), maxAgeDays);
      setRecord(next);
      setSettingsOpen(false);
      pushConsentMode(choices);
      const withdrawn = categories.filter((category) => previous[category] && !choices[category]);
      for (const category of withdrawn) {
        deleteCookies([...KNOWN_COOKIES[category], ...current.categories[category]?.cookies ?? []]);
      }
      channel.current?.postMessage("changed");
      window.dispatchEvent(new CustomEvent("clinicpro-consent:change", { detail: next }));
      try {
        current.onChange?.(next, source);
      } catch (error) {
        console.error("@clinicpro/consent: onChange failed", error);
      }
      if (withdrawn.length && reloadOnWithdraw && !sameChoices(previous, choices)) {
        window.setTimeout(() => window.location.reload(), 50);
      }
    },
    [categories, cookieName, maxAgeDays, reloadOnWithdraw]
  );
  const stringsKey = JSON.stringify(config.strings ?? null);
  const strings = React.useMemo(
    () => ({
      ...DEFAULT_STRINGS,
      ...configRef.current.strings,
      purposes: { ...DEFAULT_STRINGS.purposes, ...configRef.current.strings?.purposes }
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stringsKey]
  );
  const value = React.useMemo(() => {
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
      strings
    };
  }, [ready, record, categories, save, strings]);
  const copy = (category) => ({
    ...DEFAULT_COPY[category],
    ...config.categories[category]
  });
  const path = pathname ?? loadPath;
  const excluded = Boolean(config.exclude && path && config.exclude.test(path));
  const showBanner = ready && !record && !excluded && categories.length > 0 && !settingsOpen;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ConsentContext.Provider, { value, children: [
    showBanner && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      Banner,
      {
        strings,
        purposes: categories.map((category) => strings.purposes[category]),
        policyUrl,
        onAccept: () => save(ALL, "banner"),
        onReject: () => save(NONE, "banner"),
        onManage: () => setSettingsOpen(true)
      }
    ),
    children,
    ready && settingsOpen && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      Settings,
      {
        strings,
        categories,
        copy,
        current: record?.choices ?? NONE,
        policyUrl,
        onSave: (choices) => save(choices, "settings"),
        onAccept: () => save(ALL, "settings"),
        onReject: () => save(NONE, "settings"),
        onClose: () => setSettingsOpen(false)
      }
    )
  ] });
}
function Banner({
  strings,
  purposes,
  policyUrl,
  onAccept,
  onReject,
  onManage
}) {
  const titleId = React.useId();
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { className: "cpc-banner", role: "region", "aria-labelledby": titleId, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { id: titleId, className: "cpc-title", children: strings.bannerTitle }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { className: "cpc-text", children: [
      strings.bannerIntro,
      " ",
      listOf(purposes),
      ".",
      policyUrl && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
        " ",
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", { className: "cpc-link", href: policyUrl, children: strings.policyLink })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "cpc-buttons", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "cpc-button cpc-primary", onClick: onAccept, children: strings.acceptAll }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "cpc-button cpc-primary", onClick: onReject, children: strings.rejectAll }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "cpc-button cpc-secondary", onClick: onManage, children: strings.manage })
    ] })
  ] });
}
function Settings({
  strings,
  categories,
  copy,
  current,
  policyUrl,
  onSave,
  onAccept,
  onReject,
  onClose
}) {
  const ref = React.useRef(null);
  const titleId = React.useId();
  const [draft, setDraft] = React.useState(current);
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
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    "dialog",
    {
      ref,
      className: "cpc-dialog",
      "aria-labelledby": titleId,
      onCancel: (event) => {
        event.preventDefault();
        onClose();
      },
      onClick: (event) => {
        if (event.target === ref.current) onClose();
      },
      children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "cpc-dialog-body", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "cpc-dialog-head", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { id: titleId, className: "cpc-title", children: strings.settingsTitle }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "cpc-close", onClick: onClose, "aria-label": strings.close, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { "aria-hidden": true, children: "\xD7" }) })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { className: "cpc-text", children: [
          strings.settingsIntro,
          policyUrl && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
            " ",
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", { className: "cpc-link", href: policyUrl, children: strings.policyLink })
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", { className: "cpc-list", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { className: "cpc-item", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "cpc-item-text", children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "cpc-item-label", children: strings.necessaryLabel }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "cpc-item-description", children: strings.necessaryDescription })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "cpc-always", children: strings.alwaysOn })
          ] }),
          categories.map((category) => {
            const { label, description } = copy(category);
            const id = `cpc-${category}`;
            return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { className: "cpc-item", children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "cpc-item-text", children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { className: "cpc-item-label", htmlFor: id, children: label }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "cpc-item-description", id: `${id}-description`, children: description })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                "input",
                {
                  id,
                  type: "checkbox",
                  role: "switch",
                  className: "cpc-switch",
                  checked: draft[category],
                  "aria-describedby": `${id}-description`,
                  onChange: (event) => setDraft({ ...draft, [category]: event.target.checked })
                }
              )
            ] }, category);
          })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "cpc-buttons", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "cpc-button cpc-primary", onClick: () => onSave(draft), children: strings.save }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "cpc-button cpc-secondary", onClick: onAccept, children: strings.acceptAll }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "cpc-button cpc-secondary", onClick: onReject, children: strings.rejectAll })
        ] })
      ] })
    }
  );
}
function ConsentGate({
  category,
  children,
  fallback = null
}) {
  const { granted } = useConsent();
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children: granted(category) ? children : fallback });
}
function ConsentEmbed({
  category = "functional",
  provider,
  what,
  className,
  style,
  children
}) {
  const { granted, choices, save, ready, strings } = useConsent();
  const [once, setOnce] = React.useState(false);
  if (ready && (granted(category) || once)) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children });
  const values = { provider, what };
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: ["cpc-embed", className].filter(Boolean).join(" "), style, children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "cpc-embed-body", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "cpc-embed-title", children: fill(strings.embedTitle, values) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "cpc-embed-text", children: fill(strings.embedText, values) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "cpc-buttons", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "button",
        {
          type: "button",
          className: "cpc-button cpc-primary",
          onClick: () => setOnce(true),
          disabled: !ready,
          children: fill(strings.embedLoad, values)
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "button",
        {
          type: "button",
          className: "cpc-button cpc-secondary",
          onClick: () => save({ ...choices, [category]: true }, "embed"),
          disabled: !ready,
          children: fill(strings.embedAlways, values)
        }
      )
    ] })
  ] }) });
}
function CookieSettingsButton({
  className,
  children = "Cookie settings"
}) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className, onClick: openCookieSettings, children });
}
function ConsentHeadScript({ nonce, ...options }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    "script",
    {
      id: "clinicpro-consent-default",
      nonce,
      dangerouslySetInnerHTML: { __html: consentModeScript(options) }
    }
  );
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ALL,
  CATEGORIES,
  ConsentEmbed,
  ConsentGate,
  ConsentHeadScript,
  ConsentProvider,
  CookieSettingsButton,
  DEFAULT_COOKIE_NAME,
  DEFAULT_MAX_AGE_DAYS,
  KNOWN_COOKIES,
  NONE,
  consentModeScript,
  consentModeState,
  isCurrent,
  openCookieSettings,
  parseRecord,
  readConsent,
  readCookie,
  sameChoices,
  serialiseRecord,
  useConsent
});
//# sourceMappingURL=index.cjs.map
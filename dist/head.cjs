"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
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
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/head.ts
var head_exports = {};
__export(head_exports, {
  ALL: () => ALL,
  CATEGORIES: () => CATEGORIES,
  DEFAULT_COOKIE_NAME: () => DEFAULT_COOKIE_NAME,
  DEFAULT_MAX_AGE_DAYS: () => DEFAULT_MAX_AGE_DAYS,
  KNOWN_COOKIES: () => KNOWN_COOKIES,
  NONE: () => NONE,
  consentModeScript: () => consentModeScript,
  consentModeState: () => consentModeState,
  isCurrent: () => isCurrent,
  parseRecord: () => parseRecord,
  readConsent: () => readConsent,
  readCookie: () => readCookie,
  sameChoices: () => sameChoices,
  serialiseRecord: () => serialiseRecord
});
module.exports = __toCommonJS(head_exports);

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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ALL,
  CATEGORIES,
  DEFAULT_COOKIE_NAME,
  DEFAULT_MAX_AGE_DAYS,
  KNOWN_COOKIES,
  NONE,
  consentModeScript,
  consentModeState,
  isCurrent,
  parseRecord,
  readConsent,
  readCookie,
  sameChoices,
  serialiseRecord
});
//# sourceMappingURL=head.cjs.map
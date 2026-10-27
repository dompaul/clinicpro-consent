import { DEFAULT_COOKIE_NAME, DEFAULT_MAX_AGE_DAYS } from "./core";

export * from "./core";

/* ==========================================================================
   The script that goes first in <head>
   ==========================================================================
   Google's tags read Consent Mode the moment they load, so the default has to
   be set before any of them: everything denied except security. If the
   visitor has already chosen, their choice is applied in the same breath, so
   a returning visitor's analytics are not dropped while React starts up.

   Plain functions with no React, so an App Router server component can call
   them (the main entry is a client module).

   Only validated numbers and a validated cookie name are put into the
   script. Nothing from content or the request ever is.
   ========================================================================== */

export interface HeadScriptOptions {
  /** The site's consent version (ConsentConfig.version). */
  version: number;
  cookieName?: string;
  maxAgeDays?: number;
  /** Milliseconds Google tags wait for an update before using the default. */
  waitForUpdate?: number;
}

const COOKIE_NAME = /^[A-Za-z0-9_-]{1,64}$/;

function check(options: HeadScriptOptions) {
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
  if (!Number.isInteger(waitForUpdate) || waitForUpdate < 0 || waitForUpdate > 10_000) {
    throw new Error("@clinicpro/consent: waitForUpdate must be 0 to 10000");
  }
  return { version: options.version, cookieName, maxAgeDays, waitForUpdate };
}

/**
 * The inline script's source. Put it in a <script> as the first thing in
 * <head>, before Google Tag Manager or gtag.js (see <ConsentHeadScript> in
 * the main entry, or set it yourself with a CSP nonce).
 *
 * It mirrors parseRecord/isCurrent/consentModeState in core.ts; the tests run
 * it against the same cases so the two cannot drift.
 */
export function consentModeScript(options: HeadScriptOptions): string {
  const { version, cookieName, maxAgeDays, waitForUpdate } = check(options);
  return `(function(){
var w=window;w.dataLayer=w.dataLayer||[];
if(typeof w.gtag!=="function"){w.gtag=function(){w.dataLayer.push(arguments);};}
var D="denied",G="granted";
w.gtag("consent","default",{ad_storage:D,ad_user_data:D,ad_personalization:D,analytics_storage:D,functionality_storage:D,personalization_storage:D,security_storage:G,wait_for_update:${waitForUpdate}});
try{
var m=document.cookie.match(/(?:^|;\\s*)${cookieName}=([^;]*)/);if(!m||m[1].length>512)return;
var r=JSON.parse(decodeURIComponent(m[1]));if(!r||r.v!==${version}||typeof r.t!=="string")return;
var t=Date.parse(r.t);if(isNaN(t)||Date.now()-t>${maxAgeDays * 86_400_000}||t>Date.now()+86400000)return;
var c=r.c;if(!c||typeof c.functional!=="boolean"||typeof c.analytics!=="boolean"||typeof c.marketing!=="boolean")return;
var g=function(b){return b?G:D;};
w.gtag("consent","update",{ad_storage:g(c.marketing),ad_user_data:g(c.marketing),ad_personalization:g(c.marketing),analytics_storage:g(c.analytics),functionality_storage:g(c.functional),personalization_storage:g(c.functional),security_storage:G});
}catch(e){}
})();`;
}

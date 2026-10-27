import { describe, expect, it } from "vitest";
import {
  consentModeState,
  isCurrent,
  parseRecord,
  readConsent,
  readCookie,
  serialiseRecord,
  type ConsentRecord,
} from "../src/core";

const record = (overrides: Partial<ConsentRecord> = {}): ConsentRecord => ({
  version: 1,
  date: new Date().toISOString(),
  choices: { functional: true, analytics: false, marketing: false },
  ...overrides,
});

const raw = (value: unknown) => encodeURIComponent(JSON.stringify(value));

describe("parseRecord", () => {
  it("reads back what serialiseRecord writes", () => {
    const r = record();
    expect(parseRecord(serialiseRecord(r))).toEqual(r);
  });

  it.each([
    ["nothing", null],
    ["empty", ""],
    ["not JSON", "%7Bnot-json"],
    ["an array", raw([1, 2])],
    ["no version", raw({ t: new Date().toISOString(), c: { functional: true, analytics: true, marketing: true } })],
    ["version 0", raw({ v: 0, t: new Date().toISOString(), c: { functional: true, analytics: true, marketing: true } })],
    ["fractional version", raw({ v: 1.5, t: new Date().toISOString(), c: { functional: true, analytics: true, marketing: true } })],
    ["a bad date", raw({ v: 1, t: "yesterday", c: { functional: true, analytics: true, marketing: true } })],
    ["a missing category", raw({ v: 1, t: new Date().toISOString(), c: { functional: true, analytics: true } })],
    ["a string for a boolean", raw({ v: 1, t: new Date().toISOString(), c: { functional: "yes", analytics: true, marketing: true } })],
    ["a date far in the future", raw({ v: 1, t: "2999-01-01T00:00:00.000Z", c: { functional: true, analytics: true, marketing: true } })],
    ["something far too long", raw({ v: 1, t: new Date().toISOString(), c: { functional: true, analytics: true, marketing: true }, pad: "x".repeat(600) })],
  ])("treats %s as no choice", (_, value) => {
    expect(parseRecord(value as string | null)).toBeNull();
  });

  it("ignores extra fields but keeps only the known categories", () => {
    const parsed = parseRecord(
      raw({ v: 2, t: "2026-01-01T00:00:00.000Z", c: { functional: false, analytics: true, marketing: false, extra: true }, x: 1 }),
    );
    expect(parsed).toEqual({
      version: 2,
      date: "2026-01-01T00:00:00.000Z",
      choices: { functional: false, analytics: true, marketing: false },
    });
  });
});

describe("isCurrent", () => {
  it("needs the same version", () => {
    expect(isCurrent(record({ version: 1 }), 1)).toBe(true);
    expect(isCurrent(record({ version: 1 }), 2)).toBe(false);
  });

  it("lapses after the maximum age", () => {
    const now = Date.parse("2026-07-01T00:00:00.000Z");
    expect(isCurrent(record({ date: "2026-06-01T00:00:00.000Z" }), 1, 182, now)).toBe(true);
    expect(isCurrent(record({ date: "2025-12-01T00:00:00.000Z" }), 1, 182, now)).toBe(false);
  });

  it("is false for no record", () => {
    expect(isCurrent(null, 1)).toBe(false);
  });
});

describe("readCookie and readConsent", () => {
  it("finds a cookie among others, by exact name", () => {
    expect(readCookie("a=1; site_consent=abc; site_consent_x=2", "site_consent")).toBe("abc");
    expect(readCookie("xsite_consent=1", "site_consent")).toBeNull();
    expect(readCookie(undefined, "site_consent")).toBeNull();
  });

  it("reads a current choice from a Cookie header, for the server", () => {
    const r = record({ version: 3 });
    const header = `other=1; site_consent=${serialiseRecord(r)}`;
    expect(readConsent(header, { version: 3 })).toEqual(r);
    expect(readConsent(header, { version: 4 })).toBeNull();
  });
});

describe("consentModeState", () => {
  it("maps each category to Google's signals, security always granted", () => {
    expect(consentModeState({ functional: true, analytics: false, marketing: true })).toEqual({
      ad_storage: "granted",
      ad_user_data: "granted",
      ad_personalization: "granted",
      analytics_storage: "denied",
      functionality_storage: "granted",
      personalization_storage: "granted",
      security_storage: "granted",
    });
  });
});

import { describe, expect, it } from "vitest";
import { consentModeScript, consentModeState, serialiseRecord } from "../src/head";

type Window_ = { dataLayer: IArguments[] };

function run(script: string) {
  // eslint-disable-next-line no-new-func
  new Function(script)();
  return (window as unknown as Window_).dataLayer.map((args) => Array.from(args));
}

const choices = { functional: false, analytics: true, marketing: false };

describe("consentModeScript", () => {
  it("sets everything but security to denied before anything else", () => {
    const calls = run(consentModeScript({ version: 1 }));
    expect(calls).toHaveLength(1);
    expect(calls[0][0]).toBe("consent");
    expect(calls[0][1]).toBe("default");
    expect(calls[0][2]).toMatchObject({
      analytics_storage: "denied",
      ad_storage: "denied",
      security_storage: "granted",
      wait_for_update: 500,
    });
  });

  it("applies a returning visitor's current choice straight away, as core does", () => {
    document.cookie = `site_consent=${serialiseRecord({ version: 2, date: new Date().toISOString(), choices })}; Path=/`;
    const calls = run(consentModeScript({ version: 2 }));
    expect(calls).toHaveLength(2);
    expect(calls[1]).toEqual(["consent", "update", consentModeState(choices)]);
  });

  it.each([
    ["an older version", () => serialiseRecord({ version: 1, date: new Date().toISOString(), choices })],
    ["a lapsed choice", () => serialiseRecord({ version: 2, date: "2020-01-01T00:00:00.000Z", choices })],
    ["a tampered value", () => encodeURIComponent('{"v":2,"t":"x","c":{}}')],
    ["not JSON", () => "%7B%7B"],
  ])("ignores %s", (_, value) => {
    document.cookie = `site_consent=${value()}; Path=/`;
    expect(run(consentModeScript({ version: 2 }))).toHaveLength(1);
  });

  it("uses a custom cookie name", () => {
    document.cookie = `cc_consent=${serialiseRecord({ version: 1, date: new Date().toISOString(), choices })}; Path=/`;
    expect(run(consentModeScript({ version: 1, cookieName: "cc_consent" }))).toHaveLength(2);
  });

  it("refuses options that could inject script", () => {
    expect(() => consentModeScript({ version: 1, cookieName: 'x=1/);alert(1);//' })).toThrow();
    expect(() => consentModeScript({ version: 1.5 })).toThrow();
    expect(() => consentModeScript({ version: 1, maxAgeDays: 1000 })).toThrow();
    expect(() => consentModeScript({ version: 1, waitForUpdate: -1 })).toThrow();
  });
});

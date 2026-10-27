import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  ConsentEmbed,
  ConsentGate,
  ConsentProvider,
  openCookieSettings,
  useConsent,
  parseRecord,
  readCookie,
  serialiseRecord,
  type ConsentConfig,
} from "../src";

const config: ConsentConfig = {
  version: 1,
  policyUrl: "/cookie-policy",
  categories: { analytics: {}, functional: {} },
};

const stored = () => parseRecord(readCookie(document.cookie, "site_consent"));

const setStored = (choices: { functional: boolean; analytics: boolean; marketing: boolean }, version = 1) => {
  document.cookie = `site_consent=${serialiseRecord({ version, date: new Date().toISOString(), choices })}; Path=/`;
};

function mockReload() {
  const reload = vi.fn();
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { ...window.location, reload, pathname: "/", protocol: "http:", hostname: "localhost" },
  });
  return reload;
}

function App({ cfg = config, pathname }: { cfg?: ConsentConfig; pathname?: string }) {
  return (
    <ConsentProvider config={cfg} pathname={pathname}>
      <ConsentGate category="analytics">
        <span>analytics loaded</span>
      </ConsentGate>
      <ConsentEmbed provider="Google Maps" what="map">
        <iframe title="map" />
      </ConsentEmbed>
    </ConsentProvider>
  );
}

describe("the banner", () => {
  it("shows to someone who has not chosen, with equal Accept and Reject", async () => {
    render(<App />);
    expect(await screen.findByRole("region", { name: "Cookies on this site" })).toBeTruthy();
    const accept = screen.getByRole("button", { name: "Accept all" });
    const reject = screen.getByRole("button", { name: "Reject all" });
    expect(accept.className).toBe(reject.className);
    expect(screen.getByRole("link", { name: "Cookie policy" }).getAttribute("href")).toBe("/cookie-policy");
    // Lists only the purposes this site uses.
    expect(screen.getByText(/load maps and other content from other services and measure how the site is used/)).toBeTruthy();
  });

  it("does not show when a current choice is stored", () => {
    setStored({ functional: false, analytics: false, marketing: false });
    render(<App />);
    expect(screen.queryByRole("region", { name: "Cookies on this site" })).toBeNull();
  });

  it("shows again when the version has moved on", async () => {
    setStored({ functional: true, analytics: true, marketing: false }, 1);
    render(<App cfg={{ ...config, version: 2 }} />);
    expect(await screen.findByRole("region", { name: "Cookies on this site" })).toBeTruthy();
    // And the old choice grants nothing.
    expect(screen.queryByText("analytics loaded")).toBeNull();
  });

  it("does not show on excluded paths", () => {
    render(<App cfg={{ ...config, exclude: /^\/admin/ }} pathname="/admin/bookings" />);
    expect(screen.queryByRole("region", { name: "Cookies on this site" })).toBeNull();
  });
});

describe("choosing", () => {
  it("Accept all grants only the categories the site uses, and tells Google", async () => {
    render(<App />);
    await userEvent.click(await screen.findByRole("button", { name: "Accept all" }));
    expect(stored()?.choices).toEqual({ functional: true, analytics: true, marketing: false });
    expect(screen.getByText("analytics loaded")).toBeTruthy();
    expect(screen.getByTitle("map")).toBeTruthy();
    const dataLayer = (window as unknown as { dataLayer: IArguments[] }).dataLayer;
    const update = dataLayer.map((a) => Array.from(a)).find((a) => a[0] === "consent" && a[1] === "update");
    expect(update?.[2]).toMatchObject({ analytics_storage: "granted", ad_storage: "denied" });
    expect(screen.queryByRole("region", { name: "Cookies on this site" })).toBeNull();
  });

  it("Reject all grants nothing and the trackers never render", async () => {
    render(<App />);
    await userEvent.click(await screen.findByRole("button", { name: "Reject all" }));
    expect(stored()?.choices).toEqual({ functional: false, analytics: false, marketing: false });
    expect(screen.queryByText("analytics loaded")).toBeNull();
    expect(screen.queryByTitle("map")).toBeNull();
  });

  it("nothing is granted before a choice", async () => {
    render(<App />);
    await screen.findByRole("region", { name: "Cookies on this site" });
    expect(screen.queryByText("analytics loaded")).toBeNull();
    expect(screen.queryByTitle("map")).toBeNull();
  });

  it("calls onChange with the record and where it came from", async () => {
    const onChange = vi.fn();
    render(<App cfg={{ ...config, onChange }} />);
    await userEvent.click(await screen.findByRole("button", { name: "Reject all" }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ version: 1 }), "banner");
  });
});

describe("the settings dialog", () => {
  it("opens from the banner and saves one category", async () => {
    render(<App />);
    await userEvent.click(await screen.findByRole("button", { name: "Manage cookies" }));
    const dialog = screen.getByRole("dialog", { name: "Cookie settings" });
    expect(dialog).toBeTruthy();
    // The banner gives way to the dialog rather than sitting beside it.
    expect(screen.queryByRole("region", { name: "Cookies on this site" })).toBeNull();
    expect(screen.getByText("Always on")).toBeTruthy();
    await userEvent.click(screen.getByRole("switch", { name: "Analytics" }));
    await userEvent.click(screen.getByRole("button", { name: "Save my choices" }));
    expect(stored()?.choices).toEqual({ functional: false, analytics: true, marketing: false });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens from anywhere with openCookieSettings, showing the stored choice", async () => {
    setStored({ functional: true, analytics: false, marketing: false });
    render(<App />);
    await act(async () => openCookieSettings());
    expect((screen.getByRole("switch", { name: "Functional" }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole("switch", { name: "Analytics" }) as HTMLInputElement).checked).toBe(false);
  });

  it("withdrawing deletes that category's cookies and reloads once", async () => {
    const reload = mockReload();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    setStored({ functional: true, analytics: true, marketing: false });
    document.cookie = "_ga=GA1.1.1; Path=/";
    document.cookie = "_ga_ABC123=GS1.1; Path=/";
    document.cookie = "keep_me=1; Path=/";
    render(<App />);
    await act(async () => openCookieSettings());
    await userEvent.click(screen.getByRole("switch", { name: "Analytics" }));
    await userEvent.click(screen.getByRole("button", { name: "Save my choices" }));
    expect(document.cookie).not.toMatch(/_ga/);
    expect(document.cookie).toMatch(/keep_me=1/);
    await act(async () => vi.advanceTimersByTime(100));
    expect(reload).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("granting more does not reload", async () => {
    const reload = mockReload();
    setStored({ functional: false, analytics: false, marketing: false });
    render(<App />);
    await act(async () => openCookieSettings());
    await userEvent.click(screen.getByRole("button", { name: "Accept all" }));
    await new Promise((r) => setTimeout(r, 100));
    expect(reload).not.toHaveBeenCalled();
  });
});

describe("embeds", () => {
  it("loads once on request without storing a choice", async () => {
    setStored({ functional: false, analytics: false, marketing: false });
    render(<App />);
    await userEvent.click(await screen.findByRole("button", { name: "Load this map" }));
    expect(screen.getByTitle("map")).toBeTruthy();
    expect(stored()?.choices.functional).toBe(false);
  });

  it("Always load grants functional and keeps the rest", async () => {
    setStored({ functional: false, analytics: true, marketing: false });
    render(<App />);
    await userEvent.click(await screen.findByRole("button", { name: "Always load Google Maps" }));
    expect(stored()?.choices).toEqual({ functional: true, analytics: true, marketing: false });
  });
});

describe("safety", () => {
  it("renders configured text as text, never as markup", async () => {
    render(
      <App
        cfg={{
          ...config,
          strings: { bannerTitle: '<img src=x onerror="alert(1)">' },
        }}
      />,
    );
    expect(await screen.findByText('<img src=x onerror="alert(1)">')).toBeTruthy();
    expect(document.querySelector("img")).toBeNull();
  });

  it("refuses a policy link that is not a site path or https", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<App cfg={{ ...config, policyUrl: "javascript:alert(1)" }} />)).toThrow(/policyUrl/);
    expect(() => render(<App cfg={{ ...config, policyUrl: "//evil.example" }} />)).toThrow(/policyUrl/);
  });

  it("writes the cookie host-only, Lax, for the right length", async () => {
    const writes: string[] = [];
    const descriptor = Object.getOwnPropertyDescriptor(Document.prototype, "cookie")!;
    vi.spyOn(document, "cookie", "set").mockImplementation((value: string) => {
      writes.push(value);
      descriptor.set!.call(document, value);
    });
    render(<App />);
    await userEvent.click(await screen.findByRole("button", { name: "Reject all" }));
    const write = writes.find((w) => w.startsWith("site_consent="))!;
    expect(write).toMatch(/; Path=\/; Max-Age=15724800; SameSite=Lax/);
    expect(write).not.toMatch(/Domain=/);
  });
});

describe("other tabs", () => {
  it("follows a choice made elsewhere when the tab comes back into view", async () => {
    render(<App />);
    await screen.findByRole("region", { name: "Cookies on this site" });
    setStored({ functional: false, analytics: true, marketing: false });
    await act(async () => {
      Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(screen.getByText("analytics loaded")).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Cookies on this site" })).toBeNull();
  });
});

describe("stability", () => {
  it("does not re-render its children when the config is written inline", async () => {
    let renders = 0;
    // Reads the context, as any real consumer does: a new context value
    // would re-render it even through React.memo.
    const Child = () => {
      useConsent();
      renders += 1;
      return null;
    };
    const Memo = React.memo(Child);
    function Inline({ n }: { n: number }) {
      return (
        <ConsentProvider config={{ version: 1, policyUrl: "/cookie-policy", categories: { analytics: {} } }}>
          <span>{n}</span>
          <Memo />
        </ConsentProvider>
      );
    }
    setStored({ functional: false, analytics: true, marketing: false });
    const { rerender } = render(<Inline n={1} />);
    await screen.findByText("1");
    const settled = renders;
    rerender(<Inline n={2} />);
    rerender(<Inline n={3} />);
    await screen.findByText("3");
    expect(renders).toBe(settled);
  });
});

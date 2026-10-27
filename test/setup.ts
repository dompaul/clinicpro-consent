import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

// jsdom has no modal dialog. Enough of one for the component to drive.
if (typeof HTMLDialogElement !== "undefined" && !HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.removeAttribute("open");
  };
}

export function clearCookies() {
  for (const part of document.cookie.split(";")) {
    const name = part.split("=")[0].trim();
    if (name) document.cookie = `${name}=; Path=/; Max-Age=0`;
  }
}

afterEach(() => {
  cleanup();
  clearCookies();
  const w = window as unknown as { dataLayer?: unknown[]; gtag?: unknown };
  delete w.dataLayer;
  delete w.gtag;
  vi.restoreAllMocks();
});

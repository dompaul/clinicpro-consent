import { defineConfig } from "tsup";

export default defineConfig([
  {
    // The React entry is a client module for the App Router.
    entry: { index: "src/index.tsx" },
    format: ["esm", "cjs"],
    dts: true,
    sourcemap: true,
    external: ["react"],
    banner: { js: '"use client";' },
  },
  {
    // No React, no "use client": callable from a server component.
    entry: { head: "src/head.ts" },
    format: ["esm", "cjs"],
    dts: true,
    sourcemap: true,
  },
]);

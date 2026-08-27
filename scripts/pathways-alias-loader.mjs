// Node loader hooks so plain `node` can run modules from src/ — resolves the
// Next-style "@/…" alias against src/ and forces src's extensionless-ESM .js
// files to load as modules (the repo has no "type": "module", so node would
// otherwise read them as CJS and choke on `import`).
//
// Used by scripts/check-pathways.mjs and scripts/export-chord-progressions.mjs
// via module.register(); not part of the app build.

import { readFile } from "node:fs/promises"
import { fileURLToPath, pathToFileURL } from "node:url"
import path from "node:path"

const SRC = pathToFileURL(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src") + path.sep).href

export function resolve(specifier, context, next) {
  if (specifier.startsWith("@/")) {
    return next(SRC + specifier.slice(2) + ".js", context)
  }
  // src's own files import each other by relative path with no extension
  // (Next's bundler resolves that; plain node's ESM resolver doesn't) — but
  // only within src, so a bare package specifier like "@tonaljs/tonal" still
  // falls through to node_modules resolution untouched.
  if ((specifier.startsWith("./") || specifier.startsWith("../"))
    && !path.extname(specifier) && context.parentURL?.startsWith(SRC)) {
    return next(specifier + ".js", context)
  }
  return next(specifier, context)
}

export async function load(url, context, next) {
  if (url.startsWith(SRC) && url.endsWith(".js")) {
    const source = await readFile(fileURLToPath(url), "utf8")
    return { format: "module", source, shortCircuit: true }
  }
  return next(url, context)
}

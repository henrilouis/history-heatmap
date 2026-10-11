// The store reads the manifest version; package.json must agree with it.
import { readFile } from "node:fs/promises";

const versionOf = async (path) =>
  JSON.parse(await readFile(path, "utf8")).version;

const versions = {
  "package.json": await versionOf("package.json"),
  "public/manifest.json": await versionOf("public/manifest.json"),
};

if (new Set(Object.values(versions)).size > 1) {
  console.error("Versions differ:", versions);
  process.exit(1);
}

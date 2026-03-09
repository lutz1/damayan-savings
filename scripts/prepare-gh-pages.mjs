import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const rootDist = path.join(root, "dist");

const targets = [
  {
    source: path.join(root, "apps", "merchant-app", "dist"),
    dest: path.join(rootDist, "merchant"),
    label: "merchant-app",
  },
  {
    source: path.join(root, "apps", "rider-app", "dist"),
    dest: path.join(rootDist, "rider"),
    label: "rider-app",
  },
];

if (!existsSync(rootDist)) {
  throw new Error("Root dist folder not found. Run root build before preparing deploy.");
}

for (const target of targets) {
  if (!existsSync(target.source)) {
    throw new Error(`Missing ${target.label} build output at ${target.source}. Run its build first.`);
  }

  rmSync(target.dest, { recursive: true, force: true });
  mkdirSync(target.dest, { recursive: true });
  cpSync(target.source, target.dest, { recursive: true, force: true });
  console.log(`Copied ${target.label} -> ${path.relative(root, target.dest)}`);
}

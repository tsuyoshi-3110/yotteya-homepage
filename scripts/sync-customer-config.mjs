import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { CUSTOMER } from "../src/config/customer.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const corsPath = resolve(root, "cors.json");

const existing = JSON.parse(await readFile(corsPath, "utf8"));
const localOrigins = (existing[0]?.origin ?? []).filter(
  (origin) =>
    typeof origin === "string" &&
    (origin.startsWith("http://localhost") ||
      origin.startsWith("http://127.0.0.1") ||
      /^http:\/\/192\.168\./.test(origin)),
);

const productionOrigins = [
  CUSTOMER.productionUrl,
  CUSTOMER.productionUrl.replace("://", "://www."),
  CUSTOMER.vercelUrl,
].filter(Boolean);

existing[0].origin = Array.from(
  new Set([...productionOrigins, ...localOrigins]),
);

await writeFile(corsPath, `${JSON.stringify(existing, null, 2)}\n`);

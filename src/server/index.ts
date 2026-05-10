import { bootServer } from "./boot.js";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

void (async () => {
  const distCompanionsPath = join(process.cwd(), "dist/companions/index.js");
  const mod = await import(pathToFileURL(distCompanionsPath).href);
  await bootServer({ companions: mod.companions });
})();

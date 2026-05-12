import { build } from "vite";
import { readFileSync, realpathSync, writeFileSync } from "node:fs";
import { join } from "node:path";

await build({
  configFile: false,
  root: realpathSync(process.cwd()),
  server: {
    proxy: {
      "/api": "http://127.0.0.1:3000",
    },
  },
});

const distIndexPath = join(process.cwd(), "dist", "index.html");
const html = readFileSync(distIndexPath, "utf8");
const stylesheetAfterModuleScript =
  /(\n\s*<script type="module" crossorigin src="[^"]+\.js"><\/script>)(\n\s*<link rel="stylesheet" crossorigin href="[^"]+\.css">)/;
const stylesheetFirstHtml = html.replace(stylesheetAfterModuleScript, "$2$1");

if (stylesheetFirstHtml !== html) {
  writeFileSync(distIndexPath, stylesheetFirstHtml);
  console.log("Moved production stylesheet before module script for stable first paint");
}

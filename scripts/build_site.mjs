import { build, loadEnv } from "vite";
import { readdirSync, readFileSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = realpathSync(process.cwd());
const env = loadEnv("production", root, "");
const gaMeasurementId =
  process.env.VITE_GA_MEASUREMENT_ID?.trim() || env.VITE_GA_MEASUREMENT_ID?.trim() || "";
const shouldInjectAnalytics = /^G-[A-Z0-9]+$/i.test(gaMeasurementId);

await build({
  configFile: false,
  root,
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

const googleAnalyticsBlockPattern =
  /\s*<!-- Google tag \(gtag\.js\) -->\s*<script\b[^>]*src=["']https:\/\/www\.googletagmanager\.com\/gtag\/js\?id=G-[A-Z0-9]+["'][^>]*><\/script>\s*<script\b(?![^>]*\bsrc=)[^>]*>\s*window\.dataLayer\s*=\s*window\.dataLayer\s*\|\|\s*\[\];\s*function\s+gtag\(\)\s*\{\s*dataLayer\.push\(arguments\);\s*\}\s*gtag\(["']js["'],\s*new Date\(\)\);\s*gtag\(["']config["'],\s*["']G-[A-Z0-9]+["']\);\s*<\/script>\s*/gi;

const googleAnalyticsSnippet = (measurementId) => `    <!-- Google tag (gtag.js) -->
    <script async src="https://www.googletagmanager.com/gtag/js?id=${measurementId}"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag("js", new Date());
      gtag("config", "${measurementId}");
    </script>
`;

const htmlFiles = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      return htmlFiles(entryPath);
    }
    return entry.isFile() && entry.name.toLowerCase().endsWith(".html") ? [entryPath] : [];
  });

if (shouldInjectAnalytics) {
  let updatedHtmlFiles = 0;
  const snippet = googleAnalyticsSnippet(gaMeasurementId);

  for (const htmlPath of htmlFiles(join(process.cwd(), "dist"))) {
    if (htmlPath === distIndexPath) {
      continue;
    }

    if (statSync(htmlPath).size === 0) {
      continue;
    }

    const currentHtml = readFileSync(htmlPath, "utf8");
    const replacedExistingAnalytics = currentHtml.replace(googleAnalyticsBlockPattern, `\n${snippet}`);
    const withAnalytics =
      replacedExistingAnalytics !== currentHtml
        ? replacedExistingAnalytics
        : currentHtml.replace(/(<head\b[^>]*>)/i, `$1\n${snippet}`);

    if (withAnalytics !== currentHtml) {
      writeFileSync(htmlPath, withAnalytics);
      updatedHtmlFiles += 1;
    }
  }

  console.log(`Injected Google Analytics ${gaMeasurementId} into ${updatedHtmlFiles} HTML files`);
} else {
  console.log("Skipped Google Analytics injection because VITE_GA_MEASUREMENT_ID is not configured");
}

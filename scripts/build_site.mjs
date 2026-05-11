import { build } from "vite";
import { realpathSync } from "node:fs";

await build({
  configFile: false,
  root: realpathSync(process.cwd()),
  server: {
    proxy: {
      "/api": "http://127.0.0.1:3000",
    },
  },
});

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { existsSync, readdirSync, readFileSync } from "node:fs";

const { version } = JSON.parse(readFileSync(resolve("package.json"), "utf8"));
// Retratos são opcionais (arte licenciada adicionada localmente). Só os
// existentes são requisitados, evitando 404 para cada Servant.
const portraitDir = resolve("public/servants");
const portraits = existsSync(portraitDir)
  ? readdirSync(portraitDir)
      .filter((f) => f.endsWith(".webp"))
      .map((f) => f.slice(0, -5))
  : [];

export default defineConfig({
  root: resolve("apps/web"),
  plugins: [react()],
  publicDir: resolve("public"),
  define: {
    __APP_VERSION__: JSON.stringify(version),
    __PORTRAITS__: JSON.stringify(portraits),
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": {
        target: `http://127.0.0.1:${process.env.PORT ?? 3001}`,
        ws: true,
      },
    },
  },
  build: { outDir: resolve("dist/web"), emptyOutDir: true },
});

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
  },
  build: {
    rollupOptions: {
      output: {
        /**
         * Split the two heavy vendors out of the app chunk.
         *
         * They change far less often than our own code, so a dashboard tweak no
         * longer invalidates ~400 kB of Leaflet and Recharts in every operator's
         * browser cache, and they download in parallel with the app chunk rather
         * than inside it. Both are reached only through the code-split page
         * views in App.tsx, so the login screen pulls neither.
         */
        /**
         * Function form, not the object form. Listing `"react"` as an object key
         * only claims that one module id — React's internals and `scheduler`
         * stayed wherever they were first reached, which was inside vendor-map
         * (react-leaflet pulls React). The entry then statically imported 300 kB
         * of Leaflet just to render the login form, while the vendor-react chunk
         * came out a misleading 1 kB.
         *
         * Matching on the package directory captures the whole tree. Verify the
         * split actually holds with:
         *   grep -o 'modulepreload[^>]*' dist/index.html
         * Leaflet and Recharts must NOT appear there.
         */
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return "vendor-react";
          if (/node_modules\/(leaflet|leaflet\.heat|react-leaflet|@react-leaflet)\//.test(id)) {
            return "vendor-map";
          }
          // Recharts drags a d3 subtree with it. Grouped so a DashboardView edit
          // doesn't invalidate ~110 kB of charting library in every cache.
          if (
            /node_modules\/(recharts|react-smooth|victory-vendor|d3-[a-z]+|internmap|decimal\.js-light|fast-equals|eventemitter3|es-toolkit)\//.test(
              id
            )
          ) {
            return "vendor-charts";
          }
          return undefined;
        },
      },
    },
  },
});

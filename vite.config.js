import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { sitesStatic } from "./build/sites-vite-plugin.js";

export default defineConfig({
    plugins: [react(), sitesStatic()],
    server: {
        host: "127.0.0.1",
        port: 5173,
        proxy: {
            "/api": "http://127.0.0.1:3000"
        }
    },
    build: {
        rollupOptions: {
            input: "react.html"
        }
    }
});

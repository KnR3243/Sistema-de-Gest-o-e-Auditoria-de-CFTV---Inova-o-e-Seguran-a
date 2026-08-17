import { copyFile, cp, mkdir } from "node:fs/promises";
import { resolve } from "node:path";

/** Prepara a saída estática e o Worker de borda esperado pelo Sites. */
export function sitesStatic() {
    let root = process.cwd();

    return {
        name: "sites-static",
        apply: "build",
        configResolved(config) {
            root = config.root;
        },
        async closeBundle() {
            const dist = resolve(root, "dist");
            await mkdir(resolve(dist, "server"), { recursive: true });
            await mkdir(resolve(dist, ".openai"), { recursive: true });
            await mkdir(resolve(dist, "api"), { recursive: true });
            await copyFile(resolve(root, "worker", "index.js"), resolve(dist, "server", "index.js"));
            await copyFile(resolve(root, "api", "report-pdf.js"), resolve(dist, "api", "report-pdf.js"));
            await cp(resolve(root, "assets"), resolve(dist, "assets"), { recursive: true });
            await copyFile(resolve(root, ".openai", "hosting.json"), resolve(dist, ".openai", "hosting.json"));
            await copyFile(resolve(root, "index.html"), resolve(dist, "index.html"));
            await copyFile(resolve(root, "menu.html"), resolve(dist, "menu.html"));
            await copyFile(resolve(root, "checklist.html"), resolve(dist, "checklist.html"));
            await copyFile(resolve(root, "cameras.html"), resolve(dist, "cameras.html"));
            await copyFile(resolve(root, "historico.html"), resolve(dist, "historico.html"));
            await copyFile(resolve(root, "config.html"), resolve(dist, "config.html"));
            await copyFile(resolve(root, "logo.png"), resolve(dist, "logo.png"));
            await copyFile(resolve(root, "logo-verde.png"), resolve(dist, "logo-verde.png"));
            await copyFile(resolve(root, "fundo.jpg"), resolve(dist, "fundo.jpg"));
            await copyFile(resolve(root, "icon.ico"), resolve(dist, "icon.ico"));
        }
    };
}

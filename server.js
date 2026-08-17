import http from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { proxyRequest } from "./api/proxy-core.js";
import { createReportPdf } from "./api/report-pdf.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STATIC_ROOT = path.join(__dirname, "dist");

function loadEnvFile(fileName) {
    const filePath = path.join(__dirname, fileName);
    if (!existsSync(filePath)) return;

    const lines = readFileSync(filePath, "utf8").split(/\r?\n/);
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const separator = trimmed.indexOf("=");
        if (separator === -1) continue;

        const key = trimmed.slice(0, separator).trim();
        let value = trimmed.slice(separator + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        if (key && process.env[key] === undefined) process.env[key] = value;
    }
}

loadEnvFile(".env");
loadEnvFile(".env.local");

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";

const contentTypes = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".ico": "image/x-icon",
    ".svg": "image/svg+xml"
};

function sendJson(res, status, body, headers = {}) {
    res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        ...headers
    });
    res.end(JSON.stringify(body));
}

function readBody(req) {
    return new Promise((resolve, reject) => {
        let raw = "";
        req.on("data", (chunk) => {
            raw += chunk;
            if (raw.length > 20 * 1024 * 1024) {
                reject(new Error("Payload muito grande."));
                req.destroy();
            }
        });
        req.on("end", () => {
            if (!raw) {
                resolve({});
                return;
            }
            try {
                resolve(JSON.parse(raw));
            } catch (_) {
                reject(new Error("JSON inválido."));
            }
        });
        req.on("error", reject);
    });
}

async function serveStatic(req, res, url) {
    const requestedPath = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
    const safePath = path.normalize(requestedPath).replace(/^(\.\.[/\\])+/, "");
    const filePath = path.join(STATIC_ROOT, safePath);

    if (!filePath.startsWith(STATIC_ROOT)) {
        res.writeHead(403);
        res.end("Acesso negado.");
        return;
    }

    try {
        const file = await readFile(filePath);
        const ext = path.extname(filePath).toLowerCase();
        const immutableAsset = /\.(?:css|js|png|jpg|jpeg|ico|svg)$/i.test(filePath);

        res.writeHead(200, {
            "Content-Type": contentTypes[ext] || "application/octet-stream",
            "Cache-Control": immutableAsset ? "public, max-age=3600" : "no-cache"
        });
        res.end(file);
    } catch (_) {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Arquivo não encontrado.");
    }
}

const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

    if (url.pathname === "/api/proxy") {
        try {
            const body = req.method === "POST" ? await readBody(req) : {};
            const result = await proxyRequest({
                method: req.method,
                query: url.searchParams,
                body
            });
            sendJson(res, result.status, result.body, result.headers);
        } catch (error) {
            sendJson(res, 400, { error: error.message });
        }
        return;
    }

    if (url.pathname === "/api/report-pdf" && req.method === "POST") {
        try {
            const body = await readBody(req);
            const pdf = createReportPdf(body);
            const filename = `relatorio-cameras-${Date.now()}.pdf`;
            res.writeHead(200, {
                "Content-Type": "application/pdf",
                "Content-Disposition": `attachment; filename="${filename}"`,
                "Cache-Control": "no-store"
            });
            res.end(pdf);
        } catch (error) {
            sendJson(res, 400, { error: error.message || "Nao foi possivel gerar o PDF." });
        }
        return;
    }

    await serveStatic(req, res, url);
});

server.listen(PORT, HOST, () => {
    console.log(`SCD Cameras rodando em http://localhost:${PORT}`);
    console.log(`Para testar em outro dispositivo, abra http://SEU-IP-LOCAL:${PORT}`);
});

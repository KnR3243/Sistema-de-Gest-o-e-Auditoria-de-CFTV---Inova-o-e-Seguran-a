import { createReportPdf } from "../api/report-pdf.js";

function json(body, status = 200, headers = {}) {
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            "Content-Type": "application/json; charset=utf-8",
            ...headers
        }
    });
}

async function proxyToScript(request, env) {
    if (!env.G_SCRIPT_URL) {
        return json({ error: "Variavel de ambiente G_SCRIPT_URL ausente." }, 500, { "Cache-Control": "no-store" });
    }

    const sourceUrl = new URL(request.url);
    const targetUrl = new URL(env.G_SCRIPT_URL);
    sourceUrl.searchParams.forEach((value, key) => targetUrl.searchParams.append(key, value));

    const method = request.method.toUpperCase();
    const response = await fetch(targetUrl.toString(), {
        method,
        headers: { "Content-Type": "application/json" },
        body: method === "POST" ? await request.text() : undefined,
        redirect: "follow"
    });
    const text = await response.text();

    try {
        return json(JSON.parse(text), response.status, {
            "Cache-Control": method === "GET" ? "private, max-age=60" : "no-store"
        });
    } catch (_) {
        return json({ error: "API retornou uma resposta inesperada.", detalhes: text.slice(0, 200) }, 502);
    }
}

export default {
    async fetch(request, env) {
        const url = new URL(request.url);

        if (url.pathname === "/api/report-pdf" && request.method === "POST") {
            const body = await request.json().catch(() => ({}));
            const pdf = createReportPdf(body);
            return new Response(pdf, {
                headers: {
                    "Content-Type": "application/pdf",
                    "Content-Disposition": `attachment; filename="relatorio-cameras-${Date.now()}.pdf"`,
                    "Cache-Control": "no-store"
                }
            });
        }

        if (url.pathname === "/api/proxy") {
            return proxyToScript(request, env);
        }

        const response = await env.ASSETS.fetch(request);
        if (response.status !== 404 || request.method !== "GET") return response;

        const acceptsHTML = request.headers.get("accept")?.includes("text/html");
        if (!acceptsHTML) return response;

        const fallback = new URL("/index.html", request.url);
        return env.ASSETS.fetch(new Request(fallback, request));
    }
};

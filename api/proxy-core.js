const DEFAULT_TIMEOUT_MS = Number(process.env.PROXY_TIMEOUT_MS || 15000);
const DEFAULT_CACHE_TTL_MS = Number(process.env.PROXY_CACHE_TTL_MS || 90000);

const proxyCache = globalThis.__SCD_PROXY_CACHE || new Map();
globalThis.__SCD_PROXY_CACHE = proxyCache;

function appendQuery(targetUrl, query = {}) {
    if (query instanceof URLSearchParams) {
        query.forEach((value, key) => targetUrl.searchParams.append(key, value));
        return;
    }

    Object.entries(query).forEach(([key, value]) => {
        if (Array.isArray(value)) {
            value.forEach((item) => targetUrl.searchParams.append(key, item));
            return;
        }
        if (value !== undefined && value !== null) {
            targetUrl.searchParams.append(key, value);
        }
    });
}

function normalizeQuery(query = {}) {
    const params = new URLSearchParams();

    if (query instanceof URLSearchParams) {
        query.forEach((value, key) => params.append(key, value));
        return params;
    }

    Object.entries(query).forEach(([key, value]) => {
        if (Array.isArray(value)) {
            value.forEach((item) => params.append(key, item));
            return;
        }
        if (value !== undefined && value !== null) {
            params.append(key, value);
        }
    });

    return params;
}

function getCacheKey(url) {
    return url.toString();
}

function readCache(key) {
    const cached = proxyCache.get(key);
    if (!cached) return null;
    if (cached.expires < Date.now()) {
        proxyCache.delete(key);
        return null;
    }
    return cached.body;
}

function writeCache(key, body, ttl = DEFAULT_CACHE_TTL_MS) {
    proxyCache.set(key, {
        expires: Date.now() + ttl,
        body
    });
}

export function clearProxyCache() {
    proxyCache.clear();
}

export async function proxyRequest({ method = "GET", query = {}, body } = {}) {
    const G_URL = process.env.G_SCRIPT_URL;
    const upperMethod = method.toUpperCase();

    if (!G_URL) {
        return {
            status: 500,
            headers: { "Cache-Control": "no-store" },
            body: { error: "Variável de ambiente G_SCRIPT_URL ausente." }
        };
    }

    try {
        const targetUrl = new URL(G_URL);
        const cleanQuery = normalizeQuery(query);
        const forceRefresh = cleanQuery.has("_refresh") || cleanQuery.has("_force");

        cleanQuery.delete("_refresh");
        cleanQuery.delete("_force");
        appendQuery(targetUrl, cleanQuery);

        const isGet = upperMethod === "GET";
        const key = getCacheKey(targetUrl);

        if (isGet && forceRefresh) {
            clearProxyCache();
        }

        if (isGet && !forceRefresh) {
            const cached = readCache(key);
            if (cached) {
                return {
                    status: 200,
                    headers: {
                        "Cache-Control": "private, max-age=60",
                        "X-SCD-Cache": "hit"
                    },
                    body: cached
                };
            }
        } else {
            clearProxyCache();
        }

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

        const response = await fetch(targetUrl.toString(), {
            method: upperMethod,
            headers: { "Content-Type": "application/json" },
            body: upperMethod === "POST" ? JSON.stringify(body || {}) : undefined,
            redirect: "follow",
            signal: controller.signal
        }).finally(() => clearTimeout(timer));

        const text = await response.text();
        let payload;

        try {
            payload = JSON.parse(text);
        } catch (_) {
            return {
                status: 502,
                headers: { "Cache-Control": "no-store" },
                body: {
                    error: "Google enviou uma resposta inesperada.",
                    detalhes: text.substring(0, 200)
                }
            };
        }

        if (!response.ok) {
            return {
                status: response.status,
                headers: { "Cache-Control": "no-store" },
                body: payload
            };
        }

        if (isGet) {
            writeCache(key, payload);
        } else {
            clearProxyCache();
        }

        return {
            status: 200,
            headers: {
                "Cache-Control": isGet ? "private, max-age=60" : "no-store",
                "X-SCD-Cache": isGet ? (forceRefresh ? "refresh" : "miss") : "bypass"
            },
            body: payload
        };
    } catch (error) {
        return {
            status: error.name === "AbortError" ? 504 : 500,
            headers: { "Cache-Control": "no-store" },
            body: {
                error: error.name === "AbortError"
                    ? "Tempo limite ao consultar o Google Apps Script."
                    : error.message
            }
        };
    }
}

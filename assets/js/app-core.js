(function () {
    const API_URL = "/api/proxy";
    const DEFAULT_TIMEOUT = 15000;
    const DEFAULT_CACHE_TTL = 5 * 60 * 1000;

    function cacheKey(id) {
        return "scd_cache_" + id;
    }

    function readCache(id) {
        try {
            const raw = sessionStorage.getItem(cacheKey(id));
            if (!raw) return null;
            const cached = JSON.parse(raw);
            if (!cached.expires || cached.expires < Date.now()) {
                sessionStorage.removeItem(cacheKey(id));
                return null;
            }
            return cached.data;
        } catch (_) {
            return null;
        }
    }

    function writeCache(id, data, ttl) {
        try {
            sessionStorage.setItem(cacheKey(id), JSON.stringify({
                expires: Date.now() + ttl,
                data
            }));
        } catch (_) {
            // Cache is a speed boost only; quota/private-mode failures can be ignored.
        }
    }

    function clearCache() {
        Object.keys(sessionStorage)
            .filter((key) => key.startsWith("scd_cache_"))
            .forEach((key) => sessionStorage.removeItem(key));
    }

    function escapeHTML(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function safeUrl(value) {
        const url = String(value ?? "").trim();
        if (!url) return "#";
        if (/^(https?:|mailto:)/i.test(url)) return url;
        return "#";
    }

    async function request(actionOrPayload, options = {}) {
        const isPayload = actionOrPayload && typeof actionOrPayload === "object" && !Array.isArray(actionOrPayload);
        const method = (options.method || (isPayload ? "POST" : "GET")).toUpperCase();
        const timeout = options.timeout || DEFAULT_TIMEOUT;
        const useCache = method === "GET" && options.cache !== false;
        const params = new URLSearchParams(options.params || {});

        if (method === "GET" && typeof actionOrPayload === "string" && actionOrPayload) {
            params.set("acao", actionOrPayload);
        }

        const stableQuery = params.toString();
        const stableUrl = stableQuery ? `${API_URL}?${stableQuery}` : API_URL;
        const id = options.cacheKey || stableUrl;

        if (useCache && options.force) {
            clearCache();
            params.set("_refresh", String(Date.now()));
        }

        const query = params.toString();
        const url = query ? `${API_URL}?${query}` : API_URL;

        if (useCache && !options.force) {
            const cached = readCache(id);
            if (cached) return cached;
        }

        const controller = new AbortController();
        const timer = window.setTimeout(() => controller.abort(), timeout);

        try {
            const response = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: method === "GET" ? undefined : JSON.stringify(actionOrPayload || {}),
                cache: options.force || options.cache === false ? "no-store" : "default",
                signal: controller.signal
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || data.erro || `Servidor respondeu ${response.status}`);
            }

            if (useCache) {
                writeCache(id, data, options.cacheTtl || DEFAULT_CACHE_TTL);
            } else if (method !== "GET" || options.clearCache) {
                clearCache();
            }

            return data;
        } catch (error) {
            if (error.name === "AbortError") {
                throw new Error("A resposta demorou demais. Tente novamente.");
            }
            throw error;
        } finally {
            window.clearTimeout(timer);
        }
    }

    function requireAuth() {
        if (sessionStorage.getItem("scd_auth") !== "true") {
            window.location.href = "index.html";
            return false;
        }
        return true;
    }

    function applyTheme() {
        if (localStorage.getItem("dark-mode") === "true") {
            document.body.classList.add("dark-mode");
        }
    }

    function setBusy(button, busyText) {
        if (!button) return function noop() {};
        const original = button.innerHTML;
        button.disabled = true;
        button.innerHTML = busyText;
        return function reset() {
            button.disabled = false;
            button.innerHTML = original;
        };
    }

    window.SCD = {
        API_URL,
        request,
        clearCache,
        escapeHTML,
        safeUrl,
        requireAuth,
        applyTheme,
        setBusy
    };
}());

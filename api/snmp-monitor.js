import { createHash, randomBytes } from "node:crypto";
import net from "node:net";

const MONITOR_CACHE_TTL_MS = Math.max(5000, Number(process.env.NVR_MONITOR_CACHE_TTL_MS || 25000));
let monitorCache = null;
let monitorInFlight = null;

function env(name, fallback = "") {
    const value = process.env[name];
    return value === undefined || value === null || value === "" ? fallback : value;
}

function md5(value) {
    return createHash("md5").update(value).digest("hex");
}

function parseAuthHeader(header = "") {
    const digest = String(header).match(/Digest\s+(.+)/i)?.[1];
    if (!digest) return null;
    const fields = {};
    for (const match of digest.matchAll(/([a-zA-Z]+)=(?:"([^"]*)"|([^,\s]+))/g)) fields[match[1].toLowerCase()] = match[2] ?? match[3] ?? "";
    return fields.realm && fields.nonce ? fields : null;
}

function digestAuthorization({ username, password, method, url, challenge }) {
    const uri = `${url.pathname}${url.search}`;
    const nc = "00000001";
    const cnonce = randomBytes(12).toString("hex");
    const ha1 = md5(`${username}:${challenge.realm}:${password}`);
    const ha2 = md5(`${method}:${uri}`);
    const qop = String(challenge.qop || "").split(",").map((value) => value.trim()).includes("auth") ? "auth" : "";
    const response = qop
        ? md5(`${ha1}:${challenge.nonce}:${nc}:${cnonce}:${qop}:${ha2}`)
        : md5(`${ha1}:${challenge.nonce}:${ha2}`);
    const values = [
        `username="${username}"`, `realm="${challenge.realm}"`, `nonce="${challenge.nonce}"`, `uri="${uri}"`,
        `response="${response}"`, `algorithm=${challenge.algorithm || "MD5"}`
    ];
    if (challenge.opaque) values.push(`opaque="${challenge.opaque}"`);
    if (qop) values.push(`qop=${qop}`, `nc=${nc}`, `cnonce="${cnonce}"`);
    return `Digest ${values.join(", ")}`;
}

function createConfig() {
    return {
        host: env("NVR_API_HOST", env("SNMP_TARGET")),
        port: Number(env("NVR_API_PORT", "80")),
        protocol: env("NVR_API_PROTOCOL", "http").toLowerCase() === "https" ? "https" : "http",
        username: env("NVR_API_USER"),
        password: env("NVR_API_PASSWORD"),
        timeout: Math.max(1000, Number(env("NVR_API_TIMEOUT_MS", "6000"))),
        label: env("NVR_API_NAME", "NVR 01")
    };
}

function createConfigs() {
    const primary = createConfig();
    const configs = [primary];
    for (let index = 2; index <= 8; index += 1) {
        const host = env(`NVR_${index}_HOST`);
        if (!host) continue;
        configs.push({
            host,
            port: Number(env(`NVR_${index}_PORT`, String(primary.port))),
            protocol: env(`NVR_${index}_PROTOCOL`, primary.protocol).toLowerCase() === "https" ? "https" : "http",
            username: env(`NVR_${index}_USER`, primary.username),
            password: env(`NVR_${index}_PASSWORD`, primary.password),
            timeout: Math.max(1000, Number(env(`NVR_${index}_TIMEOUT_MS`, String(primary.timeout)))),
            label: env(`NVR_${index}_NAME`, `NVR ${String(index).padStart(2, "0")}`)
        });
    }
    return configs;
}

function validateConfig(config) {
    if (!config.host) throw new Error("Configure o NVR_API_HOST no servidor.");
    if (!config.username || !config.password) throw new Error("Configure o usuário e a senha da API do NVR no servidor.");
}

async function request(config, path) {
    const url = new URL(`${config.protocol}://${config.host}:${config.port}${path}`);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.timeout);
    try {
        let response = await fetch(url, {
            headers: { Authorization: `Basic ${Buffer.from(`${config.username}:${config.password}`).toString("base64")}` },
            signal: controller.signal
        });
        if (response.status === 401) {
            const challenge = parseAuthHeader(response.headers.get("www-authenticate"));
            if (!challenge) throw new Error("O NVR não aceitou autenticação HTTP Digest.");
            response = await fetch(url, {
                headers: { Authorization: digestAuthorization({ username: config.username, password: config.password, method: "GET", url, challenge }) },
                signal: controller.signal
            });
        }
        const body = await response.text();
        if (!response.ok) throw new Error(response.status === 401 ? "Usuário ou senha do NVR inválidos." : `O NVR respondeu ${response.status}.`);
        if (/^\s*(error|failed)\b/i.test(body)) throw new Error("O NVR recusou a consulta solicitada.");
        return body;
    } finally {
        clearTimeout(timer);
    }
}

function parseTable(body = "") {
    const values = new Map();
    String(body).split(/\r?\n/).forEach((line) => {
        const separator = line.indexOf("=");
        if (separator < 1) return;
        values.set(line.slice(0, separator).trim(), line.slice(separator + 1).trim().replace(/^"|"$/g, ""));
    });
    return values;
}

function numberFrom(value) {
    const parsed = Number(String(value ?? "").replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
}

function statusFrom(value = "") {
    const key = String(value).trim().toLowerCase();
    if (/^(online|connected|connect|normal|true|1)$/i.test(key)) return { online: true, status: "online", label: "Online" };
    if (/^(offline|disconnected|unconnected|empty|false|0|error|invalid)$/i.test(key)) return { online: false, status: "offline", label: "Offline" };
    return { online: null, status: "unknown", label: "Não informado" };
}

function channelFromKey(key) {
    const match = String(key).match(/\[(\d+)\]/);
    return match ? Number(match[1]) : null;
}

function remoteChannelFromKey(key) {
    const match = String(key).match(/NETCAMERA_INFO_(\d+)/i);
    return match ? Number(match[1]) : channelFromKey(key);
}

function mergeChannel(rows, index, patch) {
    const channel = Number(index) + 1;
    rows.set(channel, { channel, name: `Canal ${String(channel).padStart(2, "0")}`, status: "unknown", label: "Não informado", online: null, ...rows.get(channel), ...patch });
}

function valueFrom(table, expressions) {
    for (const expression of expressions) {
        for (const [key, value] of table) {
            if (expression.test(key)) return value;
        }
    }
    return null;
}

function parseNvrData({ titles, encode, status, remote, channelStatuses }) {
    const rows = new Map();
    titles.forEach((value, key) => {
        if (/ChannelTitle\[\d+\]\.Name$/i.test(key)) mergeChannel(rows, channelFromKey(key), { name: value || undefined });
    });
    encode.forEach((value, key) => {
        if (/Encode\[\d+\]\.MainFormat\[0\]\.Video\.BitRate$/i.test(key)) {
            const kbps = numberFrom(value);
            if (kbps !== null) mergeChannel(rows, channelFromKey(key), { bandwidthMbps: Math.round(kbps / 100) / 10, bandwidthType: "configurada" });
        }
    });

    status.forEach((value, key) => {
        if (!/(?:VideoIn|VideoInput|RemoteDevice)\[\d+\]\.(?:LadenBitrate|CurrentBitRate|RealBitRate)$/i.test(key)) return;
        const rate = numberFrom(value);
        if (rate === null) return;
        const mbps = rate >= 1000000 ? rate / 1000000 : rate / 1000;
        mergeChannel(rows, channelFromKey(key), { bandwidthMbps: Math.round(mbps * 10) / 10, bandwidthType: "atual" });
    });

    [status, remote].forEach((table) => table.forEach((value, key) => {
        if (!/(?:VideoIn|VideoInput|RemoteDevice)\[\d+\]\.(?:State|Status|ConnectState|Online)$/i.test(key)) return;
        const state = statusFrom(value);
        mergeChannel(rows, channelFromKey(key), state);
    }));
    remote.forEach((value, key) => {
        const channel = remoteChannelFromKey(key);
        if (/RemoteDevice.*\.(?:Address|IP|IPAddress)$/i.test(key)) mergeChannel(rows, channel, { ip: value });
        if (/RemoteDevice.*\.Name$/i.test(key) && value) mergeChannel(rows, channel, { name: value });
        if (/RemoteDevice.*\.HttpPort$/i.test(key)) mergeChannel(rows, channel, { httpPort: numberFrom(value) });
        if (/RemoteDevice.*\.Port$/i.test(key)) mergeChannel(rows, channel, { port: numberFrom(value) });
    });
    channelStatuses.forEach(({ index, table }) => {
        const state = valueFrom(table, [/(?:^|\.)(?:State|Status|ConnectState|Online)$/i]);
        if (state !== null) mergeChannel(rows, index, statusFrom(state));
        const bitrate = valueFrom(table, [/(?:LadenBitrate|CurrentBitRate|RealBitRate|BitRate)$/i]);
        const rate = numberFrom(bitrate);
        if (rate !== null) {
            const mbps = rate >= 1000000 ? rate / 1000000 : rate / 1000;
            mergeChannel(rows, index, { bandwidthMbps: Math.round(mbps * 10) / 10, bandwidthType: "atual" });
        }
    });

    return [...rows.values()].sort((left, right) => left.channel - right.channel);
}

async function optionalRequest(config, path) {
    try { return parseTable(await request(config, path)); } catch (_) { return new Map(); }
}

async function requestChannelStatuses(config, channels) {
    const results = [];
    const pending = [...channels];
    const workers = Array.from({ length: Math.min(12, pending.length) }, async () => {
        while (pending.length) {
            const index = pending.shift();
            try {
                const table = parseTable(await request(config, `/cgi-bin/devVideoInput.cgi?action=getStatus&channel=${index}`));
                if (table.size) results.push({ index, table });
            } catch (_) { /* A ausência de retorno deste canal será exibida como não informado. */ }
        }
    });
    await Promise.all(workers);
    return results;
}

function probeCamera(ip, port) {
    return new Promise((resolve) => {
        const socket = net.createConnection({ host: ip, port });
        let finished = false;
        const finish = (online) => {
            if (finished) return;
            finished = true;
            socket.destroy();
            resolve(online);
        };
        socket.setTimeout(2500);
        socket.once("connect", () => finish(true));
        socket.once("timeout", () => finish(false));
        socket.once("error", () => finish(false));
    });
}

async function probeCameraAvailability(cameras) {
    // Só usa a sonda de rede quando o NVR não informou o estado. Testar todos os
    // canais novamente acrescentava vários segundos sem melhorar o resultado.
    const pending = cameras.filter((camera) => camera.online === null && camera.ip && Number.isInteger(camera.httpPort || camera.port));
    const workers = Array.from({ length: Math.min(12, pending.length) }, async () => {
        while (pending.length) {
            const camera = pending.shift();
            const port = camera.httpPort || camera.port;
            const online = await probeCamera(camera.ip, port);
            Object.assign(camera, online
                ? { online: true, status: "online", label: "Online", statusSource: "reachability" }
                : { online: false, status: "offline", label: "Offline", statusSource: "reachability" });
        }
    });
    await Promise.all(workers);
}

function hasUsableCameraAddress(camera) {
    const octets = String(camera.ip || "").trim().split(".");
    if (octets.length !== 4 || octets.some((part) => !/^\d{1,3}$/.test(part))) return false;
    const values = octets.map(Number);
    return values.every((value) => value >= 0 && value <= 255) && values[3] !== 0 && values.some((value) => value !== 0);
}

async function monitorNvr(config) {
    validateConfig(config);
    const [system, titles, encode, status, remote] = await Promise.all([
        request(config, "/cgi-bin/magicBox.cgi?action=getSystemInfo"),
        optionalRequest(config, "/cgi-bin/configManager.cgi?action=getConfig&name=ChannelTitle"),
        optionalRequest(config, "/cgi-bin/configManager.cgi?action=getConfig&name=Encode"),
        optionalRequest(config, "/cgi-bin/devVideoInput.cgi?action=getStatus"),
        optionalRequest(config, "/cgi-bin/configManager.cgi?action=getConfig&name=RemoteDevice")
    ]);
    // Alguns NVRs não expõem esse detalhe por canal; fazer uma chamada extra por
    // câmera custava vários segundos e não melhorava o resultado. Nesses casos,
    // a sonda de conectividade abaixo é a fonte do status.
    const channelStatuses = [];
    const cameras = parseNvrData({ titles, encode, status, remote, channelStatuses }).filter(hasUsableCameraAddress);
    await probeCameraAvailability(cameras);
    const nvr = parseTable(system);
    return {
        target: config.host,
        name: config.label || nvr.get("deviceType") || nvr.get("serialNumber") || "NVR",
        total: cameras.length,
        active: cameras.filter((camera) => camera.online === true).length,
        offline: cameras.filter((camera) => camera.online === false).length,
        cameras: cameras.map((camera) => ({ ...camera, nvrName: config.label }))
    };
}

async function runMonitor() {
    const outcomes = await Promise.allSettled(createConfigs().map(monitorNvr));
    const nvrs = outcomes.filter((outcome) => outcome.status === "fulfilled").map((outcome) => outcome.value);
    if (!nvrs.length) throw new Error(outcomes[0]?.reason?.message || "Não foi possível consultar os NVRs.");
    const uniqueByIp = new Map();
    nvrs.flatMap((nvr) => nvr.cameras).forEach((camera) => {
        const ip = String(camera.ip || "").trim();
        if (ip && !uniqueByIp.has(ip)) uniqueByIp.set(ip, camera);
    });
    const cameras = [...uniqueByIp.values()];
    return {
        checkedAt: new Date().toISOString(),
        online: true,
        nvr: {
            total: cameras.length,
            active: cameras.filter((camera) => camera.online === true).length,
            offline: cameras.filter((camera) => camera.online === false).length
        },
        nvrs: nvrs.map(({ cameras: _cameras, ...nvr }) => nvr),
        cameras,
        warnings: outcomes
            .filter((outcome) => outcome.status === "rejected")
            .map((outcome) => outcome.reason?.message || "Um NVR não respondeu.")
    };
}

async function runMonitorCached() {
    if (monitorCache?.expiresAt > Date.now()) return monitorCache.data;
    if (monitorInFlight) return monitorInFlight;

    monitorInFlight = runMonitor()
        .then((data) => {
            monitorCache = { data, expiresAt: Date.now() + MONITOR_CACHE_TTL_MS };
            return data;
        })
        .finally(() => {
            monitorInFlight = null;
        });

    return monitorInFlight;
}

export async function snmpMonitorRequest() {
    try {
        return { status: 200, headers: { "Cache-Control": "no-store" }, body: await runMonitorCached() };
    } catch (error) {
        return { status: 200, headers: { "Cache-Control": "no-store" }, body: { checkedAt: new Date().toISOString(), online: false, error: error.message || "Não foi possível consultar o NVR.", cameras: [] } };
    }
}

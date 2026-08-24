const DEFAULT_ALLOWED_NETWORKS = ["127.0.0.1/32", "192.168.12.0/23"];

function parseIpv4(value = "") {
    const address = String(value).replace(/^::ffff:/i, "").trim();
    const parts = address.split(".");
    if (parts.length !== 4) return null;
    const octets = parts.map(Number);
    if (octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) return null;
    return octets.reduce((result, octet) => (result << 8) + octet, 0) >>> 0;
}

function formatIpv4(value) {
    if (value === null) return "não identificado";
    return [24, 16, 8, 0].map((shift) => (value >>> shift) & 255).join(".");
}

function configuredNetworks() {
    const configured = String(process.env.ICC_ALLOWED_NETWORKS || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    return configured.length ? configured : DEFAULT_ALLOWED_NETWORKS;
}

function belongsToNetwork(ip, cidr) {
    const [networkAddress, rawPrefix] = String(cidr).split("/");
    const network = parseIpv4(networkAddress);
    const prefix = rawPrefix === undefined ? 32 : Number(rawPrefix);
    if (ip === null || network === null || !Number.isInteger(prefix) || prefix < 0 || prefix > 32) return false;
    const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
    return (ip & mask) === (network & mask);
}

export function networkAccess(remoteAddress) {
    const ip = parseIpv4(remoteAddress);
    const allowedNetworks = configuredNetworks();
    return {
        clientIp: formatIpv4(ip),
        allowed: allowedNetworks.some((network) => belongsToNetwork(ip, network)),
        allowedNetworks
    };
}

export function reportAccessError(remoteAddress) {
    const access = networkAccess(remoteAddress);
    return {
        ...access,
        error: `A geração de relatório é permitida somente na rede ICC. IP identificado: ${access.clientIp}.`
    };
}

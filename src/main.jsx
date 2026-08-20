import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Icon } from "./icons.jsx";
import "./theme.css";

const UNITS = ["Macatuba", "Jundiai I", "Jundiai II", "Matriz"];
const NVR_NAMES = ["NVR 01", "NVR 02"];
const LOCATIONS = [
    "Portaria principal", "Recepcao", "Corredor administrativo", "Sala de TI", "Sala dos servidores",
    "Expedicao doca 1", "Expedicao doca 2", "Patio norte", "Patio sul", "Almoxarifado entrada",
    "Almoxarifado interno", "Producao linha A", "Producao linha B", "Embalagem", "Refeitorio",
    "Estacionamento", "Perimetro leste", "Perimetro oeste", "Portaria caminhoes", "Balanca",
    "Laboratorio", "Controle de qualidade", "Manutencao", "Sala de reuniao", "Financeiro",
    "Diretoria", "Gerador"
];

const ACTION_OPTIONS = [
    "Cabo reconectado / limpeza realizada",
    "Aguardando manutencao externa",
    "Substituição",
    "NVR reiniciado e monitorado",
    "Ocorrencia encaminhada para TI"
];

const API_TIMEOUT = 20000;

const LOCAL_CAMERAS = LOCATIONS.map((local, index) => ({
    id: `cam-${String(index + 1).padStart(3, "0")}`,
    rowId: `local-${index + 1}`,
    nome: `CAM-${String(index + 1).padStart(3, "0")}`,
    local,
    unidade: UNITS[index % UNITS.length],
    nvr: index < 14 ? NVR_NAMES[0] : NVR_NAMES[1],
    ip: `10.20.${index < 14 ? 1 : 2}.${40 + index}`,
    patrimonio: `ICC-CFTV-${1200 + index}`,
    status: index % 11 === 0 ? "offline" : index % 8 === 0 ? "manutencao" : "online"
}));

function App() {
    const [view, setView] = useState("report");
    const [cameras, setCameras] = useState(LOCAL_CAMERAS);
    const [apiStatus, setApiStatus] = useState("checking");
    const [collapsed, setCollapsed] = useState(false);
    const [query, setQuery] = useState("");

    useEffect(() => {
        let alive = true;
        request("getCameras")
            .then((payload) => {
                const list = Array.isArray(payload) ? payload : payload?.cameras;
                if (!alive || !Array.isArray(list) || list.length === 0) return;
                setCameras(list.map(normalizeCamera));
                setApiStatus("online");
            })
            .catch(() => {
                if (alive) setApiStatus("offline");
            });
        return () => {
            alive = false;
        };
    }, []);

    const nav = [
        ["report", "clipboard-check", "Relatorio"],
        ["cameras", "video", "Cameras"],
        ["history", "history", "Historico"],
        ["settings", "settings", "Configuracoes"]
    ];

    const pageTitle = nav.find((item) => item[0] === view)?.[2] || "Relatorio";

    return (
        <div className={`app-shell ${collapsed ? "collapsed" : ""}`}>
            <Sidebar nav={nav} view={view} setView={setView} collapsed={collapsed} setCollapsed={setCollapsed} apiStatus={apiStatus} />
            <section className="workspace">
                <Topbar title={pageTitle} query={query} setQuery={setQuery} apiStatus={apiStatus} />
                {view === "report" && <ReportPage cameras={cameras} query={query} apiStatus={apiStatus} />}
                {view === "cameras" && <CamerasPage cameras={cameras} query={query} />}
                {view === "history" && <HistoryPage />}
                {view === "settings" && <SettingsPage apiStatus={apiStatus} />}
            </section>
        </div>
    );
}

function Sidebar({ nav, view, setView, collapsed, setCollapsed, apiStatus }) {
    return (
        <aside className="sidebar">
            <div className="brand-block">
                <img src="/logo-verde.png" alt="ICC" />
                <div>
                    <strong>ICC Brazil</strong>
                    <span>Relatorio de Cameras</span>
                </div>
            </div>
            <button className="sidebar-toggle" onClick={() => setCollapsed(!collapsed)} title={collapsed ? "Expandir menu" : "Recolher menu"}>
                <Icon name={collapsed ? "chevron-right" : "chevron-left"} />
                <span>{collapsed ? "Expandir" : "Recolher"}</span>
            </button>
            <nav>
                {nav.map(([id, icon, label]) => (
                    <button key={id} className={view === id ? "active" : ""} onClick={() => setView(id)} title={label}>
                        <Icon name={icon} />
                        <span>{label}</span>
                    </button>
                ))}
            </nav>
            <div className="sidebar-footer">
                <span className={`connection ${apiStatus}`}><i />{apiStatus === "online" ? "API conectada" : apiStatus === "checking" ? "Verificando API" : "Modo local"}</span>
                <small>v1.6.0</small>
                <div className="operator"><span>KS</span><div><strong>Kaua Santos</strong><small>Operador</small></div></div>
            </div>
        </aside>
    );
}

function Topbar({ title, query, setQuery, apiStatus }) {
    const [time, setTime] = useState(new Date());

    useEffect(() => {
        const timer = window.setInterval(() => setTime(new Date()), 1000);
        return () => window.clearInterval(timer);
    }, []);

    return (
        <header className="topbar">
            <div>
                <span>Controle operacional</span>
                <h1>{title}</h1>
            </div>
            <label className="search-box">
                <Icon name="search" />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar camera, NVR, IP ou local" />
            </label>
            <div className="topbar-meta">
                <span className={`connection ${apiStatus}`}><i />{apiStatus === "online" ? "Servidor conectado" : "Modo local"}</span>
                <time>{time.toLocaleDateString("pt-BR")} {time.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</time>
            </div>
        </header>
    );
}

function ReportPage({ cameras, query, apiStatus }) {
    const [unit, setUnit] = useState(UNITS[0]);
    const [responsible, setResponsible] = useState(sessionStorage.getItem("scd_profile") || sessionStorage.getItem("scd_user") || "Kaua Santos");
    const [shift, setShift] = useState("Administrativo");
    const [entries, setEntries] = useState({});
    const [signature, setSignature] = useState("");
    const [preview, setPreview] = useState(null);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState("");

    const units = useMemo(() => unique(cameras.map((camera) => camera.unidade).filter(Boolean)), [cameras]);
    const visible = useMemo(() => cameras.filter((camera) => {
        const haystack = `${camera.nome} ${camera.local} ${camera.nvr} ${camera.ip}`.toLowerCase();
        return camera.unidade === unit && haystack.includes(query.toLowerCase());
    }), [cameras, unit, query]);

    useEffect(() => {
        if (!units.includes(unit) && units[0]) setUnit(units[0]);
    }, [unit, units]);

    useEffect(() => {
        setEntries((current) => {
            const next = { ...current };
            cameras.forEach((camera) => {
                const key = cameraKey(camera);
                if (!next[key]) {
                    next[key] = {
                        status: camera.status === "offline" ? "FALHA" : camera.status === "manutencao" ? "MANUTENCAO" : "OK",
                        action: "",
                        note: "",
                        photo: ""
                    };
                }
            });
            return next;
        });
    }, [cameras]);

    const grouped = useMemo(() => groupByNvr(visible), [visible]);
    const totals = useMemo(() => getReportTotals(visible, entries), [visible, entries]);

    function updateEntry(camera, patch) {
        const key = cameraKey(camera);
        setEntries((current) => ({ ...current, [key]: { ...current[key], ...patch } }));
    }

    function markAllOk() {
        const next = { ...entries };
        visible.forEach((camera) => {
            next[cameraKey(camera)] = { ...(next[cameraKey(camera)] || {}), status: "OK", action: "", note: "" };
        });
        setEntries(next);
        setMessage("Todas as cameras visiveis foram marcadas como funcionando.");
    }

    async function attachPhoto(camera, file) {
        if (!file) return;
        try {
            const photo = await imageToDataUrl(file);
            updateEntry(camera, { photo });
        } catch (_) {
            setMessage("Nao foi possivel carregar a evidencia.");
        }
    }

    function buildReport() {
        if (!unit) throw new Error("Selecione uma unidade.");
        if (!visible.length) throw new Error("Nenhuma camera encontrada para a unidade selecionada.");
        const rows = visible.map((camera) => {
            const entry = entries[cameraKey(camera)] || {};
            return {
                camera: camera.nome,
                local: camera.local,
                nvr: camera.nvr,
                ip: camera.ip,
                patrimonio: camera.patrimonio,
                status: entry.status || "OK",
                action: entry.status === "OK" ? "Camera operante / OK" : entry.action || "Tratativa pendente",
                note: entry.note || "",
                photo: entry.photo || ""
            };
        });
        return {
            info: {
                unit,
                date: new Date().toLocaleDateString("pt-BR"),
                time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
                responsible,
                shift,
                signature
            },
            totals: getReportTotals(visible, entries),
            rows,
            payload: {
                acao: "add_checklist",
                data: new Date().toLocaleDateString("pt-BR"),
                horario: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
                responsavel: responsible,
                unidade: unit,
                turno: shift,
                ocorrencias: rows.filter((row) => row.status !== "OK").map((row) => `${row.camera} (${formatRowDetails(row)})`).join(" | ") || "100% OK",
                observacoes: rows.filter((row) => row.note).map((row) => `${row.camera}: ${row.note}`).join(" | "),
                htmlTabelaCameras: buildApiHtml(rows),
                assinaturaB64: signature,
                linhaAssinatura: false,
                exibirLinhaAssinatura: false
            }
        };
    }

    function makePreview() {
        setMessage("");
        try {
            const report = buildReport();
            setPreview(report);
            window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
        } catch (error) {
            setMessage(error.message);
        }
    }

    async function generatePdf() {
        setBusy(true);
        setMessage("");
        try {
            const report = preview || buildReport();
            setPreview(report);

            if (apiStatus === "online") {
                try {
                    const response = await request(report.payload, { method: "POST", timeout: 45000 });
                    const link = response.linkDoc || response.linkPDF || response.LinkPDF || response.Link;
                    if (link) {
                        window.open(safeUrl(link), "_blank", "noopener");
                        setMessage("Relatorio enviado para a API e PDF aberto.");
                        return;
                    }
                } catch (_) {
                    setMessage("A API nao confirmou o PDF. Gere a copia local abaixo.");
                }
            }

            await downloadLocalPdf(report);
            setMessage(apiStatus === "online" ? "PDF local gerado como copia de seguranca." : "PDF local gerado. Para gerar pelo servidor corporativo, configure a API.");
        } catch (error) {
            setMessage(error.message || "Nao foi possivel gerar o relatorio.");
        } finally {
            setBusy(false);
        }
    }

    return (
        <main className="content report-page">
            <section className="report-header">
                <div>
                    <span>ICC Brazil</span>
                    <h2>Relatorio diario de funcionamento das cameras</h2>
                    <p>Conferencia por unidade e NVR, com ocorrencias, evidencias, assinatura do operador e PDF.</p>
                </div>
                <button className="primary" onClick={generatePdf} disabled={busy}><Icon name="file-pdf" />{busy ? "Gerando..." : "Gerar PDF"}</button>
            </section>

            <section className="summary-grid">
                <Metric label="Cameras da unidade" value={visible.length} />
                <Metric label="Funcionando" value={totals.ok} tone="success" />
                <Metric label="Com falha" value={totals.fail} tone="danger" />
                <Metric label="Manutencao" value={totals.maintenance} tone="warning" />
            </section>

            <section className="form-board">
                <label><span>Unidade</span><select value={unit} onChange={(event) => setUnit(event.target.value)}>{units.map((item) => <option key={item}>{item}</option>)}</select></label>
                <label><span>Responsavel</span><input value={responsible} onChange={(event) => setResponsible(event.target.value)} /></label>
                <label><span>Turno</span><select value={shift} onChange={(event) => setShift(event.target.value)}><option>Administrativo</option><option>Manha</option><option>Tarde</option><option>Noite</option></select></label>
                <button onClick={markAllOk}><Icon name="check-circle" />Marcar todas OK</button>
            </section>

            {message && <div className="notice">{message}</div>}

            <section className="checklist">
                {grouped.map(([nvr, items]) => (
                    <article className="nvr-section" key={nvr}>
                        <header><strong>{nvr}</strong><span>{items.length} cameras</span></header>
                        <div className="camera-list">
                            {items.map((camera) => {
                                const entry = entries[cameraKey(camera)] || {};
                                const failed = entry.status !== "OK";
                                return (
                                    <div className={`camera-row ${failed ? "attention" : ""}`} key={cameraKey(camera)}>
                                        <div className="camera-main">
                                            <StatusDot status={entry.status} />
                                            <div><strong>{camera.nome}</strong><span>{camera.local} - {camera.ip}</span></div>
                                        </div>
                                        <select value={entry.status || "OK"} onChange={(event) => updateEntry(camera, { status: event.target.value })}>
                                            <option value="OK">Funcionando</option>
                                            <option value="FALHA">Falha</option>
                                            <option value="MANUTENCAO">Manutencao</option>
                                        </select>
                                        <select value={entry.action || ""} onChange={(event) => updateEntry(camera, { action: event.target.value })} disabled={!failed}>
                                            <option value="">Tratativa</option>
                                            {ACTION_OPTIONS.map((action) => <option key={action}>{action}</option>)}
                                        </select>
                                        <textarea value={entry.note || ""} onChange={(event) => updateEntry(camera, { note: event.target.value })} placeholder="Observações" aria-label={`Observações de ${camera.nome}`} rows={2} />
                                        <label className="file-action">
                                            <input type="file" accept="image/*" onChange={(event) => attachPhoto(camera, event.target.files?.[0])} />
                                            <Icon name="camera" />
                                            <span>{entry.photo ? "Anexada" : "Evidencia"}</span>
                                        </label>
                                    </div>
                                );
                            })}
                        </div>
                    </article>
                ))}
            </section>

            <section className="signature-card">
                <div><h2>Assinatura do operador</h2><p>Assine antes de gerar o PDF final do relatorio.</p></div>
                <SignaturePad onChange={setSignature} />
            </section>

            <div className="action-bar">
                <button onClick={makePreview}><Icon name="eye" />Gerar previa</button>
                <button className="primary" onClick={generatePdf} disabled={busy}><Icon name="file-pdf" />{busy ? "Gerando..." : "Enviar e gerar PDF"}</button>
            </div>

            {preview && <ReportPreview report={preview} />}
        </main>
    );
}

function CamerasPage({ cameras, query }) {
    const filtered = cameras.filter((camera) => `${camera.nome} ${camera.local} ${camera.nvr} ${camera.ip} ${camera.unidade}`.toLowerCase().includes(query.toLowerCase()));
    return (
        <main className="content">
            <section className="section-head"><div><h2>Cadastro de cameras</h2><p>Inventario tecnico usado no relatorio diario.</p></div><button><Icon name="plus" />Nova camera</button></section>
            <div className="table-wrap">
                <table>
                    <thead><tr><th>Status</th><th>Camera</th><th>Unidade</th><th>NVR</th><th>Local</th><th>IP</th><th>Patrimonio</th><th>Acoes</th></tr></thead>
                    <tbody>{filtered.map((camera) => <tr key={cameraKey(camera)}><td><StatusDot status={camera.status === "offline" ? "FALHA" : camera.status === "manutencao" ? "MANUTENCAO" : "OK"} label /></td><td><strong>{camera.nome}</strong></td><td>{camera.unidade}</td><td>{camera.nvr}</td><td>{camera.local}</td><td>{camera.ip}</td><td>{camera.patrimonio}</td><td><button>Editar</button></td></tr>)}</tbody>
                </table>
            </div>
        </main>
    );
}

function HistoryPage() {
    const rows = [
        ["04/08/2026", "10:31", "Macatuba", "100% OK", "Kaua Santos"],
        ["03/08/2026", "17:42", "Jundiai I", "2 ocorrencias", "Operador TI"],
        ["02/08/2026", "08:16", "Matriz", "1 manutencao", "Seguranca"]
    ];
    return (
        <main className="content">
            <section className="section-head"><div><h2>Historico de relatorios</h2><p>Consulta rapida dos relatorios emitidos e PDFs gerados.</p></div></section>
            <div className="history-list">{rows.map((row) => <article key={`${row[0]}-${row[2]}`}><strong>{row[0]}</strong><span>{row[1]}</span><b>{row[2]}</b><p>{row[3]}</p><small>{row[4]}</small><button><Icon name="file-pdf" />PDF</button></article>)}</div>
        </main>
    );
}

function SettingsPage({ apiStatus }) {
    return (
        <main className="content">
            <section className="settings-panel">
                <h2>Configuracoes</h2>
                <div className="setting-row"><span>Status da API corporativa</span><strong>{apiStatus === "online" ? "Conectada" : "Nao configurada neste ambiente"}</strong></div>
                <div className="setting-row"><span>Acao de envio do relatorio</span><strong>add_checklist</strong></div>
                <div className="setting-row"><span>Geracao local de PDF</span><strong>Ativa</strong></div>
                <p>O app continua preparado para usar a API segura da ICC. Quando a variavel do servidor estiver configurada, o envio usa o fluxo corporativo; enquanto isso, o PDF local permite validar o relatorio.</p>
            </section>
        </main>
    );
}

function SignaturePad({ onChange }) {
    const canvasRef = useRef(null);
    const [signed, setSigned] = useState(false);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return undefined;
        const ctx = canvas.getContext("2d");
        let drawing = false;

        function resize() {
            const rect = canvas.getBoundingClientRect();
            const data = signed ? canvas.toDataURL("image/png") : null;
            canvas.width = Math.max(320, Math.floor(rect.width));
            canvas.height = 150;
            ctx.lineWidth = 2.5;
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            ctx.strokeStyle = "#1f2937";
            if (data) {
                const image = new Image();
                image.onload = () => ctx.drawImage(image, 0, 0);
                image.src = data;
            }
        }

        function point(event) {
            const rect = canvas.getBoundingClientRect();
            return { x: event.clientX - rect.left, y: event.clientY - rect.top };
        }

        function start(event) {
            event.preventDefault();
            drawing = true;
            const pos = point(event);
            ctx.beginPath();
            ctx.moveTo(pos.x, pos.y);
        }

        function move(event) {
            if (!drawing) return;
            event.preventDefault();
            const pos = point(event);
            ctx.lineTo(pos.x, pos.y);
            ctx.stroke();
            setSigned(true);
            onChange(canvas.toDataURL("image/png"));
        }

        function stop() {
            drawing = false;
        }

        resize();
        canvas.addEventListener("pointerdown", start);
        canvas.addEventListener("pointermove", move);
        canvas.addEventListener("pointerup", stop);
        canvas.addEventListener("pointerleave", stop);
        window.addEventListener("resize", resize);
        return () => {
            canvas.removeEventListener("pointerdown", start);
            canvas.removeEventListener("pointermove", move);
            canvas.removeEventListener("pointerup", stop);
            canvas.removeEventListener("pointerleave", stop);
            window.removeEventListener("resize", resize);
        };
    }, [onChange, signed]);

    function clear() {
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
        setSigned(false);
        onChange("");
    }

    return (
        <div className="signature-pad-wrap">
            <canvas ref={canvasRef} />
            <div><span className={signed ? "signed" : ""}>{signed ? "Assinatura capturada" : "Assinatura pendente"}</span><button onClick={clear}><Icon name="x" />Limpar</button></div>
        </div>
    );
}

function ReportPreview({ report }) {
    return (
        <section className="preview-card">
            <header><div><h2>Previa do relatorio</h2><p>{report.info.unit} - {report.info.date} as {report.info.time}</p></div><StatusSummary totals={report.totals} /></header>
            <div className="preview-table">
                <table>
                    <thead><tr><th>Camera</th><th>NVR</th><th>Local</th><th>Status</th><th>Tratativa / observacao</th></tr></thead>
                    <tbody>{report.rows.map((row) => <tr key={`${row.camera}-${row.local}`}><td>{row.camera}</td><td>{row.nvr}</td><td>{row.local}</td><td>{row.status}</td><td>{formatRowDetails(row)}</td></tr>)}</tbody>
                </table>
            </div>
        </section>
    );
}

function StatusSummary({ totals }) {
    return <div className="status-summary"><span>{totals.ok} OK</span><span>{totals.fail} falha</span><span>{totals.maintenance} manutencao</span></div>;
}

function Metric({ label, value, tone = "" }) {
    return <article className={`metric ${tone}`}><span>{label}</span><strong>{value}</strong></article>;
}

function StatusDot({ status, label = false }) {
    const normalized = status === "FALHA" ? "fail" : status === "MANUTENCAO" ? "maintenance" : "ok";
    const text = normalized === "fail" ? "Falha" : normalized === "maintenance" ? "Manutencao" : "OK";
    return <span className={`status-dot ${normalized}`}><i />{label && text}</span>;
}

async function request(actionOrPayload, options = {}) {
    const isPayload = actionOrPayload && typeof actionOrPayload === "object";
    const method = (options.method || (isPayload ? "POST" : "GET")).toUpperCase();
    const params = new URLSearchParams(options.params || {});
    if (method === "GET" && typeof actionOrPayload === "string") params.set("acao", actionOrPayload);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeout || API_TIMEOUT);
    const url = params.toString() ? `/api/proxy?${params}` : "/api/proxy";
    try {
        const response = await fetch(url, {
            method,
            headers: { "Content-Type": "application/json" },
            body: method === "GET" ? undefined : JSON.stringify(actionOrPayload || {}),
            signal: controller.signal
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || payload.erro || `Servidor respondeu ${response.status}`);
        return payload;
    } finally {
        clearTimeout(timer);
    }
}

async function downloadLocalPdf(report) {
    const response = await fetch("/api/report-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(report)
    });
    if (!response.ok) {
        openPrintableReport(report);
        return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `relatorio-cameras-${report.info.unit.toLowerCase().replace(/\s+/g, "-")}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

function openPrintableReport(report) {
    const win = window.open("", "_blank", "noopener");
    if (!win) throw new Error("O navegador bloqueou a janela do PDF.");
    win.document.write(buildPrintableHtml(report));
    win.document.close();
    win.focus();
    win.print();
}

function buildPrintableHtml(report) {
    return `<!doctype html><html><head><title>Relatorio de Cameras</title><style>body{font-family:Arial,sans-serif;color:#1f2937;margin:32px}h1{font-size:20px}table{width:100%;border-collapse:collapse;font-size:11px}th,td{border:1px solid #999;padding:7px;text-align:left}th{background:#e5e7eb}.bad{color:#b91c1c;font-weight:bold}.ok{color:#166534;font-weight:bold}</style></head><body><h1>Relatorio de Cameras - ICC Brazil</h1><p>${escapeHtml(report.info.unit)} - ${escapeHtml(report.info.date)} ${escapeHtml(report.info.time)} - Responsavel: ${escapeHtml(report.info.responsible)}</p><table><thead><tr><th>Camera</th><th>NVR</th><th>Local</th><th>Status</th><th>Tratativa / Observacoes</th></tr></thead><tbody>${report.rows.map((row) => `<tr><td>${escapeHtml(row.camera)}</td><td>${escapeHtml(row.nvr)}</td><td>${escapeHtml(row.local)}</td><td class="${row.status === "OK" ? "ok" : "bad"}">${escapeHtml(row.status)}</td><td>${escapeHtml(formatRowDetails(row))}</td></tr>`).join("")}</tbody></table></body></html>`;
}

function buildApiHtml(rows) {
    const groups = rows.reduce((map, row) => {
        if (!map[row.nvr]) map[row.nvr] = [];
        map[row.nvr].push(row);
        return map;
    }, {});
    return Object.entries(groups).map(([nvr, items]) => `<div style="background:#2e7d32;color:#fff;padding:6px 10px;font-weight:bold">${escapeHtml(nvr)}</div><table style="width:100%;border-collapse:collapse;font-size:11px"><thead><tr><th style="border:1px solid #333;padding:6px">Camera</th><th style="border:1px solid #333;padding:6px">Status</th><th style="border:1px solid #333;padding:6px">Tratativa / Observacoes</th></tr></thead><tbody>${items.map((row) => `<tr><td style="border:1px solid #333;padding:6px">${escapeHtml(row.camera)} - ${escapeHtml(row.local)}</td><td style="border:1px solid #333;padding:6px">${escapeHtml(row.status)}</td><td style="border:1px solid #333;padding:6px">${escapeHtml(formatRowDetails(row))}</td></tr>`).join("")}</tbody></table>`).join("");
}

function formatRowDetails(row) {
    return [row.action || "", row.note ? `Obs.: ${row.note}` : ""].filter(Boolean).join(" | ") || "-";
}

function normalizeCamera(camera, index) {
    return {
        id: camera.id || camera.rowId || `api-${index}`,
        rowId: camera.rowId || camera.id || `api-${index}`,
        nome: camera.nome || camera.Nome || camera.camera || `CAM-${String(index + 1).padStart(3, "0")}`,
        local: camera.local || camera.Local || "Sem local",
        unidade: camera.unidade || camera.Unidade || UNITS[0],
        nvr: camera.nvr || camera.NVR || "NVR 01",
        ip: camera.ip || camera.IP || "--",
        patrimonio: camera.patrimonio || camera.Patrimonio || camera.asset || "--",
        status: String(camera.status || camera.Status || "online").toLowerCase()
    };
}

function cameraKey(camera) {
    return camera.rowId || camera.id || `${camera.unidade}-${camera.nvr}-${camera.nome}-${camera.local}`;
}

function unique(values) {
    return [...new Set(values)].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function groupByNvr(list) {
    const groups = new Map();
    list.forEach((camera) => {
        const key = camera.nvr || "Sem NVR";
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(camera);
    });
    return [...groups.entries()];
}

function getReportTotals(list, entries) {
    return list.reduce((acc, camera) => {
        const status = entries[cameraKey(camera)]?.status || "OK";
        if (status === "FALHA") acc.fail += 1;
        else if (status === "MANUTENCAO") acc.maintenance += 1;
        else acc.ok += 1;
        return acc;
    }, { ok: 0, fail: 0, maintenance: 0 });
}

function imageToDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function safeUrl(value) {
    try {
        const url = new URL(value);
        return ["http:", "https:"].includes(url.protocol) ? url.toString() : "#";
    } catch (_) {
        return "#";
    }
}

function escapeHtml(value = "") {
    return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
}

createRoot(document.getElementById("root")).render(<App />);

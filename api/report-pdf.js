function normalizeText(value = "") {
    return String(value)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^\x20-\x7E]/g, "");
}

function pdfEscape(value = "") {
    return normalizeText(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function splitText(value, max = 78) {
    const words = normalizeText(value).split(/\s+/).filter(Boolean);
    const lines = [];
    let current = "";
    words.forEach((word) => {
        if (`${current} ${word}`.trim().length > max) {
            if (current) lines.push(current);
            current = word;
            return;
        }
        current = `${current} ${word}`.trim();
    });
    if (current) lines.push(current);
    return lines.length ? lines : [""];
}

function addText(content, x, y, size, text) {
    content.push(`BT /F1 ${size} Tf ${x} ${y} Td (${pdfEscape(text)}) Tj ET`);
}

function buildPages(report = {}) {
    const rows = Array.isArray(report.rows) ? report.rows : [];
    const info = report.info || {};
    const totals = report.totals || {};
    const snmpSummary = report.snmp?.summary || report.snmpSummary || "";
    const pages = [];
    let content = [];
    let y = 800;

    function newPage() {
        if (content.length) pages.push(content.join("\n"));
        content = [];
        y = 800;
        addText(content, 42, y, 16, "Relatorio de Cameras - ICC Brazil");
        y -= 24;
        addText(content, 42, y, 10, `Unidade: ${info.unit || "-"}    Data: ${info.date || "-"} ${info.time || ""}    Responsavel: ${info.responsible || "-"}`);
        y -= 16;
        addText(content, 42, y, 10, `Resumo: ${totals.ok || 0} OK | ${totals.fail || 0} falha(s) | ${totals.maintenance || 0} manutencao`);
        if (snmpSummary) {
            y -= 16;
            splitText(`SNMP: ${snmpSummary}`, 105).forEach((line) => {
                addText(content, 42, y, 9, line);
                y -= 12;
            });
        }
        y -= 24;
        addText(content, 42, y, 10, "Camera                         NVR       Local                         Status       Tratativa / Observacao");
        y -= 18;
    }

    newPage();

    rows.forEach((row) => {
        const details = [row.action || "", row.note ? `Obs.: ${row.note}` : ""].filter(Boolean).join(" | ") || "-";
        const firstLine = `${row.camera || "-"} | ${row.nvr || "-"} | ${row.local || "-"} | ${row.status || "-"} | ${details}`;
        const wrapped = splitText(firstLine, 95);
        if (y - wrapped.length * 14 < 54) newPage();
        wrapped.forEach((line) => {
            addText(content, 42, y, 9, line);
            y -= 14;
        });
        y -= 4;
    });

    if (info.signature) {
        if (y < 110) newPage();
        addText(content, 42, y, 10, "Assinatura do operador: registrada digitalmente no sistema.");
        y -= 18;
    }

    pages.push(content.join("\n"));
    return pages;
}

function encodeLatin1(value) {
    const output = new Uint8Array(value.length);
    for (let index = 0; index < value.length; index += 1) {
        output[index] = value.charCodeAt(index) & 0xff;
    }
    return output;
}

export function createReportPdf(report = {}) {
    const pages = buildPages(report);
    const objects = [];
    objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
    objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";

    const pageRefs = [];
    pages.forEach((pageContent) => {
        const contentObject = objects.length;
        objects[contentObject] = `<< /Length ${pageContent.length} >>\nstream\n${pageContent}\nendstream`;
        const pageObject = objects.length;
        objects[pageObject] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentObject} 0 R >>`;
        pageRefs.push(`${pageObject} 0 R`);
    });

    objects[2] = `<< /Type /Pages /Kids [${pageRefs.join(" ")}] /Count ${pageRefs.length} >>`;

    let pdf = "%PDF-1.4\n";
    const offsets = [0];
    for (let index = 1; index < objects.length; index += 1) {
        offsets[index] = pdf.length;
        pdf += `${index} 0 obj\n${objects[index]}\nendobj\n`;
    }
    const xref = pdf.length;
    pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
    for (let index = 1; index < objects.length; index += 1) {
        pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
    }
    pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
    return encodeLatin1(pdf);
}

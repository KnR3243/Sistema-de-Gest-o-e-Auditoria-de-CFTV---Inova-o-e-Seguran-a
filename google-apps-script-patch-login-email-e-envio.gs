/**
 * PATCH PARA O BACKEND ATUAL DO SCD
 *
 * Objetivo:
 * - Fazer o login devolver também o e-mail da aba "Usuarios", coluna D.
 * - Criar a ação POST "send_report_email" para envio automático real.
 *
 * Estrutura esperada da aba Usuarios:
 * A: usuario
 * B: senha
 * C: perfil
 * D: email
 */

/**
 * 1) NO BLOCO DE LOGIN, troque este retorno:
 *
 * return responder({ sucesso: true, perfil: usuarios[i][2] });
 *
 * por este:
 */
function exemploRetornoLoginComEmail_(usuarios, i) {
  return responder({
    sucesso: true,
    perfil: usuarios[i][2],
    email: usuarios[i][3] ? usuarios[i][3].toString().trim() : ""
  });
}

/**
 * 2) DENTRO DO doPost(e), logo depois do bloco de login
 *    e antes das ações de câmeras/checklist, adicione:
 *
 * if (dados.acao === 'send_report_email') {
 *   return responder(enviarEmailRelatorioCameras_(dados));
 * }
 */

function enviarEmailRelatorioCameras_(dados) {
  try {
    var destinatario = String(dados.destinatario || dados.emailDestino || "").trim();
    if (!destinatario || destinatario.indexOf("@") === -1) {
      return {
        sucesso: false,
        erro: "Destinatário de e-mail inválido."
      };
    }

    var assunto = String(dados.assunto || "Relatório de Câmeras").trim();
    var mensagem = String(dados.mensagem || "").trim();
    var linkDoc = String(dados.linkDoc || "").trim();
    var unidade = String(dados.unidade || "").trim();
    var data = String(dados.data || "").trim();
    var horario = String(dados.horario || "").trim();
    var responsavel = String(dados.responsavel || "").trim();
    var resumo = String(dados.resumo || "").trim();

    if (!mensagem) {
      mensagem = [
        "Olá " + (responsavel || ""),
        "",
        "Segue o relatório de verificação das câmeras" + (unidade ? " da unidade " + unidade : "") + ".",
        "",
        data || horario ? "Data/Hora: " + data + (horario ? " às " + horario : "") : "",
        responsavel ? "Responsável: " + responsavel : "",
        resumo ? "Resumo: " + resumo : "",
        linkDoc ? "PDF do relatório: " + linkDoc : "",
        "",
        "Atenciosamente",
        "Equipe de TI"
      ].filter(Boolean).join("\n");
    }

    var htmlBody = mensagem
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\n/g, "<br>");

    var opcoes = {
      to: destinatario,
      subject: assunto,
      body: mensagem,
      htmlBody: htmlBody,
      name: "Gestão de Câmeras - ICC"
    };

    var anexoPdf = obterAnexoPdfDoDrive_(linkDoc);
    if (anexoPdf) {
      opcoes.attachments = [anexoPdf];
    }

    MailApp.sendEmail(opcoes);

    return {
      sucesso: true,
      sent: true,
      mensagem: "E-mail enviado com sucesso.",
      anexoPdf: Boolean(anexoPdf)
    };
  } catch (erro) {
    return {
      sucesso: false,
      erro: erro && erro.message ? erro.message : String(erro)
    };
  }
}

function obterAnexoPdfDoDrive_(linkDoc) {
  var fileId = extrairIdArquivoDrive_(linkDoc);
  if (!fileId) return null;

  try {
    var arquivo = DriveApp.getFileById(fileId);
    var blob = arquivo.getBlob();

    if (blob.getContentType() !== MimeType.PDF) {
      blob = arquivo.getAs(MimeType.PDF);
    }

    return blob.setName(arquivo.getName().replace(/\.pdf$/i, "") + ".pdf");
  } catch (erro) {
    return null;
  }
}

function extrairIdArquivoDrive_(url) {
  if (!url) return "";

  var texto = String(url);
  var match = texto.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (match && match[1]) return match[1];

  match = texto.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (match && match[1]) return match[1];

  return "";
}

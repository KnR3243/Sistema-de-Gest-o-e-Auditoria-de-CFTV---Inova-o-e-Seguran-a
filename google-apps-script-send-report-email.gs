/**
 * Ação para adicionar na API Google Apps Script do projeto.
 *
 * Como usar:
 * 1. Abra o projeto do Google Apps Script que publica a URL usada em G_SCRIPT_URL.
 * 2. Cole estas funções no projeto.
 * 3. Dentro do doPost(e) existente, antes do retorno de "ação não reconhecida",
 *    adicione:
 *
 *    if (dados.acao === 'send_report_email') {
 *      return respostaJson_(sendReportEmail_(dados));
 *    }
 *
 * Se o seu doPost usa outro nome de variável no lugar de "dados", use esse nome.
 */

function respostaJson_(objeto) {
  return ContentService
    .createTextOutput(JSON.stringify(objeto))
    .setMimeType(ContentService.MimeType.JSON);
}

function sendReportEmail_(dados) {
  try {
    var destinatario = String(dados.destinatario || dados.emailDestino || '').trim();
    if (!destinatario || destinatario.indexOf('@') === -1) {
      return {
        sucesso: false,
        erro: 'Destinatário de e-mail inválido.'
      };
    }

    var assunto = String(dados.assunto || 'Relatório de Câmeras').trim();
    var mensagem = String(dados.mensagem || '').trim();
    var linkDoc = String(dados.linkDoc || '').trim();
    var unidade = String(dados.unidade || '').trim();
    var data = String(dados.data || '').trim();
    var horario = String(dados.horario || '').trim();
    var responsavel = String(dados.responsavel || '').trim();
    var resumo = String(dados.resumo || '').trim();

    if (!mensagem) {
      mensagem = [
        'Olá,',
        '',
        'Segue o relatório de verificação das câmeras.',
        '',
        unidade ? 'Unidade: ' + unidade : '',
        data || horario ? 'Data/Hora: ' + data + (horario ? ' às ' + horario : '') : '',
        responsavel ? 'Responsável: ' + responsavel : '',
        resumo ? 'Resumo: ' + resumo : '',
        linkDoc ? 'PDF do relatório: ' + linkDoc : '',
        '',
        'Atenciosamente',
        'Equipe de TI'
      ].filter(Boolean).join('\n');
    }

    var htmlBody = mensagem
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>');

    var opcoes = {
      to: destinatario,
      subject: assunto,
      body: mensagem,
      htmlBody: htmlBody,
      name: 'Gestão de Câmeras - ICC'
    };

    var anexo = getDrivePdfAttachment_(linkDoc);
    if (anexo) {
      opcoes.attachments = [anexo];
    }

    MailApp.sendEmail(opcoes);

    return {
      sucesso: true,
      sent: true,
      mensagem: 'E-mail enviado com sucesso.',
      anexoPdf: Boolean(anexo)
    };
  } catch (erro) {
    return {
      sucesso: false,
      erro: erro && erro.message ? erro.message : String(erro)
    };
  }
}

function getDrivePdfAttachment_(linkDoc) {
  var fileId = extractDriveFileId_(linkDoc);
  if (!fileId) return null;

  try {
    var file = DriveApp.getFileById(fileId);
    var blob = file.getBlob();

    if (blob.getContentType() !== MimeType.PDF) {
      blob = file.getAs(MimeType.PDF);
    }

    return blob.setName(file.getName().replace(/\.pdf$/i, '') + '.pdf');
  } catch (erro) {
    return null;
  }
}

function extractDriveFileId_(url) {
  if (!url) return '';

  var texto = String(url);
  var match = texto.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (match && match[1]) return match[1];

  match = texto.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (match && match[1]) return match[1];

  return '';
}

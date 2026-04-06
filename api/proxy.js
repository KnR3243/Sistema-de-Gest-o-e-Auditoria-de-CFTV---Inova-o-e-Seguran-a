export default async function handler(req, res) {
  const G_URL = process.env.G_SCRIPT_URL; 

  // Verifica se a variável existe
  if (!G_URL) {
    return res.status(500).json({ error: "Variável G_SCRIPT_URL não encontrada nas configurações da Vercel." });
  }

  try {
    const urlParams = new URLSearchParams(req.query).toString();
    const finalUrl = urlParams ? `${G_URL}?${urlParams}` : G_URL;

    const options = {
      method: req.method,
      headers: { 'Content-Type': 'application/json' },
      redirect: 'follow' // OBRIGATÓRIO para Google Apps Script
    };

    // Só adiciona body se for POST e houver dados
    if (req.method === 'POST' && req.body) {
      options.body = JSON.stringify(req.body);
    }

    const response = await fetch(finalUrl, options);
    const data = await response.json();

    return res.status(200).json(data);

  } catch (error) {
    console.error("Erro no Proxy:", error);
    return res.status(500).json({ error: "Falha na conexão com o Banco de Dados", detalhes: error.message });
  }
}
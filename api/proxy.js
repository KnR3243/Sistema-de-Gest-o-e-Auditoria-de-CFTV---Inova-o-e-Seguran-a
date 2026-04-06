export default async function handler(req, res) {
  const G_URL = process.env.G_SCRIPT_URL;

  if (!G_URL) {
    return res.status(500).json({ error: "A variável G_SCRIPT_URL não foi encontrada no Vercel." });
  }

  try {
    // 1. Usa a API moderna para evitar o erro de Depreciação [DEP0169]
    const targetUrl = new URL(G_URL);
    
    // Repassa parâmetros se for um GET (ex: ?acao=getCameras)
    if (req.method === 'GET') {
      Object.keys(req.query).forEach(key => targetUrl.searchParams.append(key, req.query[key]));
    }

    const options = {
      method: req.method,
      headers: { 'Content-Type': 'application/json' },
      redirect: 'follow' // OBRIGATÓRIO para Google Script
    };

    if (req.method === 'POST') {
      options.body = JSON.stringify(req.body);
    }

    const response = await fetch(targetUrl.toString(), options);
    const responseText = await response.text(); // Lemos como texto primeiro para não travar

    try {
      // Tenta transformar em JSON
      const data = JSON.parse(responseText);
      return res.status(200).json(data);
    } catch (parseError) {
      // Se cair aqui, o Google mandou um HTML. 
      // Vamos mandar os primeiros 200 caracteres para você ler o erro real no console.
      return res.status(500).json({ 
        error: "O Google respondeu com HTML (Página de erro/login)", 
        debug: responseText.substring(0, 300) 
      });
    }

  } catch (error) {
    return res.status(500).json({ error: "Erro de conexão no servidor Vercel", detalhes: error.message });
  }
}
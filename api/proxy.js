export default async function handler(req, res) {
  const G_URL = process.env.G_SCRIPT_URL;

  if (!G_URL) {
    return res.status(500).json({ error: "Variável G_SCRIPT_URL não configurada no Vercel." });
  }

  try {
    // 1. Configura os parâmetros da URL para métodos GET
    const urlWithParams = new URL(G_URL);
    if (req.method === 'GET') {
      Object.keys(req.query).forEach(key => urlWithParams.searchParams.append(key, req.query[key]));
    }

    // 2. Prepara a requisição para o Google
    const options = {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
      },
      redirect: 'follow'
    };

    // 3. Se for POST, envia o body como string
    if (req.method === 'POST') {
      options.body = JSON.stringify(req.body);
    }

    const response = await fetch(urlWithParams.toString(), options);
    const text = await response.text(); // Pegamos como texto primeiro para validar

    try {
      const data = JSON.parse(text);
      return res.status(200).json(data);
    } catch (parseError) {
      // Se cair aqui, o Google devolveu HTML (Erro 404, 500 do Google ou Tela de Login)
      console.error("O Google não devolveu JSON. Resposta recebida:", text.substring(0, 200));
      return res.status(500).json({ 
        error: "O Google enviou uma resposta inválida (HTML).", 
        debug: text.substring(0, 100) 
      });
    }

  } catch (error) {
    console.error("Erro no servidor Proxy:", error);
    return res.status(500).json({ error: "Erro interno no Proxy", detalhes: error.message });
  }
}
export default async function handler(req, res) {
  const url = process.env.G_SCRIPT_URL;

  // TESTE 1: A variável existe?
  if (!url) {
    return res.status(500).json({ 
      erro: "A Vercel NÃO está encontrando a variável de ambiente G_SCRIPT_URL",
      ajuda: "Verifique se o nome na Settings da Vercel é EXATAMENTE G_SCRIPT_URL"
    });
  }

  try {
    const response = await fetch(url, {
      method: req.method,
      headers: { "Content-Type": "application/json" },
      body: req.method === "POST" ? JSON.stringify(req.body) : undefined,
      redirect: "follow"
    });

    const text = await response.text();

    try {
      // Se for JSON, o sistema funcionou
      return res.status(200).json(JSON.parse(text));
    } catch (e) {
      // TESTE 2: O que o Google respondeu de verdade?
      return res.status(500).json({ 
        erro: "O Google respondeu algo que não é código (HTML)",
        o_que_o_google_disse: text.substring(0, 500) // Isso vai aparecer na sua tela!
      });
    }
  } catch (error) {
    return res.status(500).json({ erro: "Erro de conexão", detalhes: error.message });
  }
}
export default async function handler(req, res) {
  const G_URL = process.env.G_SCRIPT_URL; // Defina isso no painel da Vercel

  if (!G_URL) return res.status(500).json({ error: "API URL não configurada." });

  try {
    const targetUrl = new URL(G_URL);
    // Repassa parâmetros de busca (GET)
    Object.keys(req.query).forEach(key => targetUrl.searchParams.append(key, req.query[key]));

    const response = await fetch(targetUrl.toString(), {
      method: req.method,
      headers: { 'Content-Type': 'application/json' },
      body: req.method === 'POST' ? JSON.stringify(req.body) : undefined,
      redirect: 'follow' 
    });

    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: "Erro de conexão", detalhes: error.message });
  }
}
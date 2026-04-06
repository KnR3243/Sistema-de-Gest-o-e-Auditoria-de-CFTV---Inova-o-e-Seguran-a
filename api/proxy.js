export default async function handler(req, res) {
  const G_URL = process.env.G_SCRIPT_URL;

  if (!G_URL) return res.status(500).json({ error: "Variável de ambiente ausente." });

  try {
    const targetUrl = new URL(G_URL);
    // Repassa os parâmetros do GET (?acao=...)
    Object.keys(req.query).forEach(key => targetUrl.searchParams.append(key, req.query[key]));

    const response = await fetch(targetUrl.toString(), {
      method: req.method,
      headers: { 'Content-Type': 'application/json' },
      body: req.method === 'POST' ? JSON.stringify(req.body) : undefined,
      redirect: 'follow'
    });

    const text = await response.text();
    try {
      return res.status(200).json(JSON.parse(text));
    } catch (e) {
      return res.status(500).json({ error: "Google enviou HTML", detalhes: text.substring(0, 200) });
    }
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
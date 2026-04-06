// api/proxy.js
export default async function handler(req, res) {
  const G_URL = process.env.G_SCRIPT_URL; // A URL ficará escondida no painel do Vercel
  
  const urlParams = new URLSearchParams(req.query).toString();
  const finalUrl = urlParams ? `${G_URL}?${urlParams}` : G_URL;

  try {
    const response = await fetch(finalUrl, {
      method: req.method,
      body: req.method === 'POST' ? JSON.stringify(req.body) : undefined,
    });
    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: "Erro na conexão com o Banco de Dados" });
  }
}
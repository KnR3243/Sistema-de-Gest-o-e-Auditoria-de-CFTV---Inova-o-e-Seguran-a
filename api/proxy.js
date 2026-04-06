export default async function handler(req, res) {
  const G_URL = process.env.G_SCRIPT_URL; 

  if (!G_URL) {
    return res.status(500).json({ error: "A variavel G_SCRIPT_URL não foi configurada na Vercel." });
  }


  const urlParams = new URLSearchParams(req.query).toString();
  const finalUrl = urlParams ? `${G_URL}?${urlParams}` : G_URL;

  try {
    const options = {
      method: req.method,
      headers: { 'Content-Type': 'application/json' },
      redirect: 'follow' 
    };

    if (req.method === 'POST') {
      options.body = JSON.stringify(req.body);
    }

    const response = await fetch(finalUrl, options);
    const data = await response.json();

    res.status(200).json(data);

  } catch (error) {
    res.status(500).json({ error: "Falha na conexão", detalhes: error.message });
  }
}
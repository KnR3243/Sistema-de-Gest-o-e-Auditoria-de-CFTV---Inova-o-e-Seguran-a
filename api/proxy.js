export default async function handler(req, res) {
    const G_URL = process.env.G_SCRIPT_URL;

    if (!G_URL) {
        return res.status(500).json({ error: "Variável G_SCRIPT_URL não configurada no painel da Vercel." });
    }

    try {
        // Prepara as configurações da requisição
        const options = {
            method: req.method,
            headers: {
                'Content-Type': 'application/json',
            },
            // O Google Apps Script SEMPRE redireciona. Sem isso dá erro 500.
            redirect: 'follow' 
        };

        // Se for POST, anexa o corpo da mensagem
        if (req.method === 'POST') {
            options.body = JSON.stringify(req.body);
        }

        // Adiciona parâmetros de URL (se houver, como ?acao=getCameras)
        const urlParams = new URLSearchParams(req.query).toString();
        const finalUrl = urlParams ? `${G_URL}?${urlParams}` : G_URL;

        const response = await fetch(finalUrl, options);
        
        // Lê a resposta como texto primeiro para evitar erro de parse
        const responseText = await response.text();
        
        try {
            const data = JSON.parse(responseText);
            return res.status(200).json(data);
        } catch (e) {
            // Se o Google retornar erro em HTML em vez de JSON
            return res.status(500).json({ error: "Resposta do Google não é um JSON válido", detalhes: responseText });
        }

    } catch (error) {
        return res.status(500).json({ error: "Erro interno no servidor Vercel", detalhes: error.message });
    }
}
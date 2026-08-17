import { proxyRequest } from "./proxy-core.js";

export default async function handler(req, res) {
  const result = await proxyRequest({
    method: req.method,
    query: req.query,
    body: req.body
  });

  Object.entries(result.headers || {}).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  return res.status(result.status).json(result.body);
}

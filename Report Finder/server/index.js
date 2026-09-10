import express from "express";
import cors from "cors";

const PORT = process.env.PORT || 4000;
const PYTHON_API = process.env.PYTHON_API || "http://127.0.0.1:8000";

const app = express();
app.use(cors());

app.get("/api/search", async (req, res) => {
  const { q, top_k } = req.query;
  if (!q) {
    return res.status(400).json({ error: "Missing query parameter 'q'" });
  }

  const params = new URLSearchParams({ q, top_k: top_k || "5" });
  try {
    const upstream = await fetch(`${PYTHON_API}/api/search?${params}`);
    const data = await upstream.json();
    res.status(upstream.status).json(data);
  } catch (err) {
    res.status(502).json({ error: "Search service unavailable", detail: err.message });
  }
});

app.get("/api/report/:id", async (req, res) => {
  try {
    const upstream = await fetch(`${PYTHON_API}/api/report/${encodeURIComponent(req.params.id)}`);
    const data = await upstream.json();
    res.status(upstream.status).json(data);
  } catch (err) {
    res.status(502).json({ error: "Search service unavailable", detail: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Node backend listening on http://localhost:${PORT}`);
});

// ============================================================
//  reportFinderService.js
//  Thin proxy client for the "Report Finder" Python microservice
//  (../Report Finder/search_api.py) — a Flask + ChromaDB semantic
//  search API over the report catalog (Excel -> embeddings, see
//  build_report_vectorstore.py). Runs as its own container
//  ("report-finder" in docker-compose.yml) since it needs a
//  HuggingFace embedding model + Chroma, which don't belong in the
//  Node process.
// ============================================================

const axios = require('axios');

const BASE_URL = process.env.REPORT_FINDER_URL || 'http://127.0.0.1:8000';

const client = axios.create({ baseURL: BASE_URL, timeout: 15_000 });

async function search(query, topK) {
  const res = await client.get('/api/search', { params: { q: query, top_k: topK } });
  return res.data;
}

async function getReport(id) {
  const res = await client.get(`/api/report/${encodeURIComponent(id)}`);
  return res.data;
}

module.exports = { search, getReport };

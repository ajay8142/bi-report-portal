from flask import Flask, jsonify, request
from flask_cors import CORS
import chromadb
from langchain_huggingface import HuggingFaceEmbeddings

DB_PATH = "./chroma_store"
COLLECTION_NAME = "report_metadata"
# BGE models are trained to expect this prefix on queries (not on documents)
# for best retrieval accuracy.
QUERY_INSTRUCTION = "Represent this question for searching relevant passages: "

METADATA_FIELDS = [
    "Report Name",
    "Module",
    "Description",
    "Tables",
    "Columns",
    "Parameters",
    "Sql Queries",
]

app = Flask(__name__)
CORS(app)

_embeddings = None
_client = None
_collection = None


def get_embeddings():
    global _embeddings
    if _embeddings is None:
        _embeddings = HuggingFaceEmbeddings(
            model_name="BAAI/bge-large-en-v1.5",
            model_kwargs={"device": "cpu"},
            encode_kwargs={"normalize_embeddings": True},
        )
    return _embeddings


def get_collection():
    global _client, _collection
    if _collection is None:
        _client = chromadb.PersistentClient(path=DB_PATH)
        _collection = _client.get_or_create_collection(
            name=COLLECTION_NAME,
            metadata={"hnsw:space": "cosine"},
        )
    return _collection


@app.route("/health")
def health():
    return jsonify({"status": "ok"})


@app.route("/api/search")
def search():
    query = request.args.get("q", "").strip()
    top_k = int(request.args.get("top_k", 5))
    if not query:
        return jsonify({"error": "Missing query parameter 'q'"}), 400

    collection = get_collection()
    query_vec = get_embeddings().embed_query(QUERY_INSTRUCTION + query)
    results = collection.query(query_embeddings=[query_vec], n_results=top_k)

    hits = [
        {
            "id": rid,
            "reportName": meta.get("Report Name", ""),
            "module": meta.get("Module", ""),
            "distance": dist,
        }
        for rid, meta, dist in zip(
            results["ids"][0], results["metadatas"][0], results["distances"][0]
        )
    ]
    return jsonify(hits)


@app.route("/api/report/<report_id>")
def report(report_id):
    collection = get_collection()
    results = collection.get(ids=[report_id])
    if not results["ids"]:
        return jsonify({"error": "Report not found"}), 404

    meta = results["metadatas"][0]
    return jsonify({field: meta.get(field, "") for field in METADATA_FIELDS})


if __name__ == "__main__":
    print("Loading embedding model (one-time, ~30s-2min on CPU)...")
    get_embeddings()
    get_collection()
    print("Ready.")
    # host 0.0.0.0 so other containers (the Node backend) can reach this
    # service over the docker network; debug off since this runs unattended.
    app.run(host="0.0.0.0", port=8000, debug=False, use_reloader=False)

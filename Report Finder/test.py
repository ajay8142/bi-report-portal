import argparse
import sys

import chromadb
from langchain_huggingface import HuggingFaceEmbeddings

DB_PATH = "./chroma_store"
COLLECTION_NAME = "report_metadata"
QUERY_INSTRUCTION = "Represent this question for searching relevant passages: "

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

METADATA_FIELDS = [
    "Report Name",
    "Module",
    "Description",
    "Tables",
    "Columns",
    "Parameters",
    "Sql Queries",
]


def load_embeddings():
    return HuggingFaceEmbeddings(
        model_name="BAAI/bge-large-en-v1.5",
        model_kwargs={"device": "cpu"},
        encode_kwargs={"normalize_embeddings": True},
    )


def print_report(rid, meta, distance=None):
    header = f"id={rid}"
    if distance is not None:
        header += f"  distance={distance:.4f}"
    print(header)
    for field in METADATA_FIELDS:
        print(f"  {field:<11}: {meta.get(field, '')}")
    print("-" * 70)


def search(query, column, value, top_k, db_path, collection_name):
    client = chromadb.PersistentClient(path=db_path)
    collection = client.get_or_create_collection(
        name=collection_name,
        metadata={"hnsw:space": "cosine"},
    )

    where = {column: value} if column and value else None

    if query:
        embeddings = load_embeddings()
        query_vec = embeddings.embed_query(QUERY_INSTRUCTION + query)
        results = collection.query(
            query_embeddings=[query_vec], n_results=top_k, where=where
        )
        for rid, meta, dist in zip(
            results["ids"][0], results["metadatas"][0], results["distances"][0]
        ):
            print_report(rid, meta, dist)
    else:
        if not where:
            raise ValueError("Provide --query text, or both --column and --value.")
        results = collection.get(where=where, limit=top_k)
        for rid, meta in zip(results["ids"], results["metadatas"]):
            print_report(rid, meta)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Search reports by free text and/or an exact metadata column match."
    )
    parser.add_argument("query", nargs="?", default=None, help="Free-text search query")
    parser.add_argument(
        "--column",
        choices=METADATA_FIELDS,
        help="Metadata field to filter on, e.g. Module",
    )
    parser.add_argument("--value", help="Exact value to match for --column, e.g. Finance")
    parser.add_argument("--top-k", type=int, default=5, help="Number of results (default: 5)")
    parser.add_argument("--db", default=DB_PATH, help="Chroma persistent storage folder")
    parser.add_argument("--collection", default=COLLECTION_NAME, help="Chroma collection name")
    args = parser.parse_args()

    search(args.query, args.column, args.value, args.top_k, args.db, args.collection)

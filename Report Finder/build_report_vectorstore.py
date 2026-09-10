import argparse
import ast
import json

import pandas as pd
import chromadb
from langchain_huggingface import HuggingFaceEmbeddings


# --------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------
def to_list(value):
    """Normalize a cell that may be a comma-separated string, a JSON/py-list
    string, NaN, or already a list into a clean list[str]."""
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return []
    if isinstance(value, list):
        return [str(v).strip() for v in value]
    text = str(value).strip()
    if not text:
        return []
    # Try to parse "['A', 'B']" style strings first
    if text.startswith("["):
        try:
            parsed = ast.literal_eval(text)
            if isinstance(parsed, list):
                return [str(v).strip() for v in parsed]
        except (ValueError, SyntaxError):
            pass
    # Fall back to comma-separated
    return [p.strip() for p in text.split(",") if p.strip()]


def row_to_text(row: dict) -> str:
    """Builds the natural-language text that actually gets embedded.
    This is what semantic search matches against, so make it descriptive."""
    parts = [
        f"Report Name: {row.get('Report Name', '')}",
        f"Module: {row.get('Module', '')}",
        f"Description: {row.get('Description', '')}",
        f"Tables: {', '.join(row.get('Tables', []))}",
        f"Columns: {', '.join(row.get('Columns', []))}",
        f"Parameters: {', '.join(row.get('Parameters', []))}",
    ]
    return "\n".join(p for p in parts if p.strip())


def row_to_metadata(row: dict) -> dict:
    """Chroma metadata values must be str / int / float / bool (no lists/None),
    so list fields are stored as comma-joined strings, and the full original
    row is also stashed as a JSON string for easy reconstruction."""
    meta = {
        "Report Name": str(row.get("Report Name", "")),
        "Module": str(row.get("Module", "")),
        "Description": str(row.get("Description", "")),
        "Tables": ", ".join(row.get("Tables", [])),
        "Columns": ", ".join(row.get("Columns", [])),
        "Parameters": ", ".join(row.get("Parameters", [])),
        "Sql Queries": str(row.get("SQL Queries", "")),
    }
    return meta


# --------------------------------------------------------------------------
# Main pipeline
# --------------------------------------------------------------------------
def main(excel_path: str, db_path: str, collection_name: str, sheet_name):
    # 1. Load Excel
    df = pd.read_excel(excel_path, sheet_name=sheet_name)
    df.columns = [c.strip() for c in df.columns]

    for col in ["Tables", "Columns", "Parameters"]:
        if col in df.columns:
            df[col] = df[col].apply(to_list)
        else:
            df[col] = [[] for _ in range(len(df))]

    records = df.to_dict(orient="records")
    print(f"Loaded {len(records)} report rows from {excel_path}")

    # 2. Build the embedding model (free, runs locally, no API key needed)
    embeddings = HuggingFaceEmbeddings(
        model_name="BAAI/bge-large-en-v1.5",
        model_kwargs={"device": "cpu"},          # use "cuda" if you have a GPU
        encode_kwargs={"normalize_embeddings": True, "batch_size": 32},  # cosine-similarity ready
        show_progress=True,  # prints a tqdm bar so long CPU runs aren't silent
    )

    # 3. Prepare texts / ids / metadata
    texts = [row_to_text(r) for r in records]
    ids = [str(r.get("id", i + 1)) for i, r in enumerate(records)]
    metadatas = [row_to_metadata(r) for r in records]

    # 4. Generate embeddings (batched call — much faster than one-by-one)
    print("Generating embeddings...")
    vectors = embeddings.embed_documents(texts)
    print(f"Generated {len(vectors)} vectors of dimension {len(vectors[0])}")

    # 5. Store in ChromaDB
    client = chromadb.PersistentClient(path=db_path)
    collection = client.get_or_create_collection(
        name=collection_name,
        metadata={"hnsw:space": "cosine"},
    )

    collection.upsert(
        ids=ids,
        embeddings=vectors,
        documents=texts,
        metadatas=metadatas,
    )
    print(f"Stored {len(ids)} records in Chroma collection '{collection_name}' at '{db_path}'")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Embed Excel report metadata into ChromaDB")
    parser.add_argument("--excel", required=True, help="Path to the Excel file")
    parser.add_argument("--sheet", default=0, help="Sheet name or index (default: first sheet)")
    parser.add_argument("--db", default="./chroma_store", help="Chroma persistent storage folder")
    parser.add_argument("--collection", default="report_metadata", help="Chroma collection name")
    args = parser.parse_args()

    main(args.excel, args.db, args.collection, args.sheet)

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain_postgres import PGVector
from langchain.chains import RetrievalQA
from langchain.retrievers import EnsembleRetriever, ContextualCompressionRetriever
from langchain_community.retrievers import BM25Retriever
from langchain_cohere import CohereRerank
from langchain_core.documents import Document
from langsmith import traceable
from dotenv import load_dotenv
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

import os
import uvicorn

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --------- CONFIG ---------
PGVECTOR_CONNECTION_STRING = os.environ.get("PGVECTOR_URL")
COLLECTION_NAME = "covercraft_rag"
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
COHERE_API_KEY = os.environ.get("COHERE_API_KEY")
assert PGVECTOR_CONNECTION_STRING and OPENAI_API_KEY and COHERE_API_KEY, "Missing env vars: PGVECTOR_URL, OPENAI_API_KEY, COHERE_API_KEY"

# LangSmith tracing — activated by env vars; setdefault keeps explicit overrides intact
os.environ.setdefault("LANGCHAIN_TRACING_V2", "true")
os.environ.setdefault("LANGCHAIN_PROJECT", "covercraft")

# --------- MODELS ---------
embedding_model = OpenAIEmbeddings(openai_api_key=OPENAI_API_KEY)
llm = ChatOpenAI(openai_api_key=OPENAI_API_KEY, model="gpt-4o", temperature=0.2)

# --------- VECTOR STORE ---------
vectorstore = PGVector(
    connection=PGVECTOR_CONNECTION_STRING,
    collection_name=COLLECTION_NAME,
    embeddings=embedding_model,
)

# --------- IN-MEMORY BM25 CORPUS ---------
# BM25Retriever operates over an in-memory document list.
# Each call to /process-document appends here so semantic and keyword
# retrievers always cover the same corpus.
all_documents: list[Document] = []


# --------- RETRIEVER FACTORY ---------
def build_retriever() -> ContextualCompressionRetriever:
    """
    Build the full three-stage hybrid retrieval chain:

      Stage 1 — EnsembleRetriever (semantic 60% + BM25 40%)
        pgvector cosine similarity handles semantic intent;
        BM25 keyword matching catches exact terminology in resumes/JDs.

      Stage 2 — CohereRerank
        Cross-encoder reranker scores all candidates together and
        returns the top_n most relevant passages, removing false positives
        that either retriever alone would pass through.

      Stage 3 — ContextualCompressionRetriever
        Wraps the base retriever + compressor into a single interface
        that the QA chain calls like any ordinary retriever.

    Falls back to semantic-only when no documents have been ingested yet
    (BM25 requires at least one document to initialise).
    """
    semantic_retriever = vectorstore.as_retriever(search_kwargs={"k": 5})

    if all_documents:
        bm25_retriever = BM25Retriever.from_documents(all_documents)
        bm25_retriever.k = 5
        base_retriever: EnsembleRetriever | any = EnsembleRetriever(
            retrievers=[semantic_retriever, bm25_retriever],
            weights=[0.6, 0.4],
        )
    else:
        base_retriever = semantic_retriever

    cohere_reranker = CohereRerank(
        cohere_api_key=COHERE_API_KEY,
        model="rerank-english-v3.0",
        top_n=3,
    )

    return ContextualCompressionRetriever(
        base_compressor=cohere_reranker,
        base_retriever=base_retriever,
    )


def build_qa_chain() -> RetrievalQA:
    return RetrievalQA.from_chain_type(
        llm=llm,
        retriever=build_retriever(),
        return_source_documents=True,
    )


# Build chain at startup — semantic-only until first document is ingested
qa_chain = build_qa_chain()


# --------- API MODELS ---------
class QueryRequest(BaseModel):
    query: str


class DocumentRequest(BaseModel):
    text: str


# --------- CORE RAG FUNCTION (traced by LangSmith) ---------
@traceable(name="rag-query")
def run_rag_query(query: str) -> dict:
    """
    Executes the full RAG pipeline for a single query.
    The @traceable decorator sends a structured trace to LangSmith:
    inputs, retrieved sources, LLM prompt, generated output, and latency.
    """
    result = qa_chain({"query": query})
    return {
        "answer": result["result"],
        "sources": [doc.page_content for doc in result["source_documents"]],
    }


# --------- ENDPOINTS ---------
@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/query-document")
async def query_rag(req: QueryRequest):
    try:
        return run_rag_query(req.query)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/process-document")
async def process_document(req: DocumentRequest):
    """
    Ingests a plain-text document (resume or JD) into the pipeline:
      1. Splits on double newlines into paragraph-level chunks
      2. Embeds and persists chunks to pgvector (durable, survives restarts)
      3. Appends Document objects to the in-memory BM25 corpus
      4. Rebuilds the full retriever chain so new content is immediately queryable
    """
    global qa_chain
    try:
        paragraphs = req.text.split("\n\n")
        paragraphs = [p.strip() for p in paragraphs if p.strip()]

        # Wrap as Document objects — compatible with both pgvector and BM25
        docs = [Document(page_content=p) for p in paragraphs]

        # Persist embeddings to pgvector
        vectorstore.add_documents(docs)

        # Extend in-memory BM25 corpus and rebuild the full retriever chain
        all_documents.extend(docs)
        qa_chain = build_qa_chain()

        return {
            "message": "Document processed and embeddings stored",
            "count": len(docs),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)

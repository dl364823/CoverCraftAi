from fastapi import FastAPI
from pydantic import BaseModel
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain_postgres import PGVector
from langchain.chains import RetrievalQA
from dotenv import load_dotenv
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

import os
import uvicorn

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # or ["http://localhost:3000"] for more security
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --------- CONFIG ---------
PGVECTOR_CONNECTION_STRING = os.environ.get("PGVECTOR_URL")  
COLLECTION_NAME = "covercraft_rag"
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
assert PGVECTOR_CONNECTION_STRING and OPENAI_API_KEY, "Missing environment variables"

# --------- RAG Setup ---------
embedding_model = OpenAIEmbeddings(openai_api_key=OPENAI_API_KEY)

vectorstore = PGVector(
    connection=PGVECTOR_CONNECTION_STRING,
    collection_name=COLLECTION_NAME,
    embeddings=embedding_model,
)

retriever = vectorstore.as_retriever(search_kwargs={"k": 3})
llm = ChatOpenAI(openai_api_key=OPENAI_API_KEY, model="gpt-4o", temperature=0.2)

qa_chain = RetrievalQA.from_chain_type(
    llm=llm,
    retriever=retriever,
    return_source_documents=True
)

# --------- API Input ---------
class QueryRequest(BaseModel):
    query: str

@app.get("/health")
async def health():
    return {"status": "ok"}

@app.post("/query-document")
async def query_rag(req: QueryRequest):
    try:
        result = qa_chain({"query": req.query})
        return {
            "answer": result["result"],
            "sources": [doc.page_content for doc in result["source_documents"]]
        }
    except Exception as e:
        return {"error": str(e)}

@app.post("/process-document")
async def process_document(req: DocumentRequest):
    try:
        paragraphs = req.text.split("\n\n")
        paragraphs = [p.strip() for p in paragraphs if p.strip()]
        embeddings = embedding_model.embed_documents(paragraphs)
        vectorstore.add_vectors(embeddings, paragraphs)
        return {"message": "Document processed and embeddings stored", "count": len(embeddings)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
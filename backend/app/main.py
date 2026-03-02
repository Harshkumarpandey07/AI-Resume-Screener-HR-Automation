from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
from app.database import init_db
from app.routes import jobs, resumes, candidates, emails

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield

app = FastAPI(title="HireAI API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(jobs.router, prefix="/api/jobs", tags=["Jobs"])
app.include_router(resumes.router, prefix="/api/resumes", tags=["Resumes"])
app.include_router(candidates.router, prefix="/api/candidates", tags=["Candidates"])
app.include_router(emails.router, prefix="/api/emails", tags=["Emails"])

@app.get("/health")
async def health(): return {"status": "ok", "service": "HireAI"}

from fastapi.staticfiles import StaticFiles

app.mount("/", StaticFiles(directory="../frontend/build", html=True), name="static")
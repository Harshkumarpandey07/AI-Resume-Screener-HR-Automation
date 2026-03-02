from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.candidate import Candidate

router = APIRouter()

@router.get("/")
async def list_candidates(
    decision: str = Query(None),
    job_id: str = Query(None),
    db: AsyncSession = Depends(get_db)
):
    q = select(Candidate).order_by(Candidate.screened_at.desc())
    if decision: q = q.where(Candidate.decision == decision)
    if job_id: q = q.where(Candidate.job_id == job_id)
    result = await db.execute(q)
    candidates = result.scalars().all()
    return [{"id":c.id,"name":c.name,"email":c.email,"position":c.position,
             "jobId":c.job_id,"score":c.score,"decision":c.decision,
             "strengths":c.strengths,"missing":c.missing,"recommendation":c.recommendation,
             "education":c.education,"experience":c.years_experience,
             "emailSent":c.email_sent,"screenedAt":c.screened_at.isoformat()} for c in candidates]
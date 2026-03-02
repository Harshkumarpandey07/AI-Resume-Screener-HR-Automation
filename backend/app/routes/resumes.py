from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.candidate import Candidate
from app.models.job import Job
from app.services.resume_parser import parse_resume
from app.services.ai_screener import screen_resume
import uuid, os

router = APIRouter()

@router.post("/screen")
async def screen_resumes(
    files: list[UploadFile] = File(...),
    job_id: str = Form(None),
    custom_jd: str = Form(None),
    threshold: int = Form(70),
    db: AsyncSession = Depends(get_db)
):
    job = None
    if job_id:
        result = await db.execute(select(Job).where(Job.id == job_id))
        job = result.scalar_one_or_none()

    jd = custom_jd or (job.description if job else "")
    if not jd:
        raise HTTPException(400, "Job description required")

    results = []
    for file in files:
        try:
            content = await file.read()
            resume_text = parse_resume(content, file.filename)
            ai_result = screen_resume(
                resume_text, jd,
                job.title if job else "Position",
                threshold,
                os.getenv("AI_MODEL", "claude-sonnet-4-20250514")
            )
            candidate = Candidate(
                id=str(uuid.uuid4()),
                name=ai_result["candidate_name"],
                email=ai_result.get("candidate_email", ""),
                position=job.title if job else "General",
                job_id=job_id,
                score=ai_result["score"],
                decision=ai_result["decision"],
                recommendation=ai_result.get("recommendation", ""),
                years_experience=ai_result.get("years_experience"),
                education=ai_result.get("education", ""),
                resume_text=resume_text[:2000],
            )
            candidate.strengths = ai_result.get("strengths", [])
            candidate.missing = ai_result.get("missing_skills", [])
            db.add(candidate)
            if job:
                job.candidate_count = (job.candidate_count or 0) + 1
            results.append({**ai_result, "id": candidate.id, "filename": file.filename})
        except Exception as e:
            results.append({"filename": file.filename, "error": str(e)})

    await db.commit()
    return {"results": results, "total": len(results)}
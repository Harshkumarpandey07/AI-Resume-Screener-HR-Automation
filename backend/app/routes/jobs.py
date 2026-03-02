from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.job import Job
from pydantic import BaseModel
from typing import Optional
import uuid

router = APIRouter()

class JobCreate(BaseModel):
    title: str
    department: Optional[str] = None
    location: Optional[str] = None
    description: str
    skills: list[str] = []

@router.get("/")
async def list_jobs(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Job).order_by(Job.created_at.desc()))
    jobs = result.scalars().all()
    return [{"id":j.id,"title":j.title,"department":j.department,"location":j.location,
             "description":j.description,"skills":j.skills,"candidateCount":j.candidate_count,
             "createdAt":j.created_at.isoformat()} for j in jobs]

@router.post("/")
async def create_job(data: JobCreate, db: AsyncSession = Depends(get_db)):
    job = Job(id=str(uuid.uuid4()), title=data.title, department=data.department,
              location=data.location, description=data.description)
    job.skills = data.skills
    db.add(job)
    await db.commit()
    await db.refresh(job)
    return {"id":job.id,"title":job.title,"message":"Job created"}

@router.delete("/{job_id}")
async def delete_job(job_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Job).where(Job.id == job_id))
    job = result.scalar_one_or_none()
    if not job: raise HTTPException(404, "Not found")
    await db.delete(job)
    await db.commit()
    return {"deleted": job_id}
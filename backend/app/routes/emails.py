from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.candidate import Candidate
from app.services.email_service import render_email, send_email_sendgrid, send_email_smtp
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import os

router = APIRouter()

class EmailCampaign(BaseModel):
    decision_filter: str  # ACCEPT | INTERVIEW | REJECT | ALL
    template_type: str    # accept | interview | reject | custom
    custom_subject: Optional[str] = None
    custom_body: Optional[str] = None
    company_name: str = "Our Company"

@router.post("/send")
async def send_campaign(data: EmailCampaign, db: AsyncSession = Depends(get_db)):
    q = select(Candidate)
    if data.decision_filter != "ALL":
        q = q.where(Candidate.decision == data.decision_filter)
    result = await db.execute(q)
    candidates = result.scalars().all()
    if not candidates:
        raise HTTPException(400, "No candidates found")

    sent, failed = 0, 0
    for c in candidates:
        try:
            subject, body = render_email(data.template_type, {
                "name": c.name.split()[0], "position": c.position, "company": data.company_name
            })
            if data.custom_subject: subject = data.custom_subject
            if data.custom_body: body = data.custom_body.replace("{{NAME}}", c.name.split()[0])

            # Try SendGrid first, fallback to SMTP
            email_api_key = os.getenv("SENDGRID_API_KEY")
            from_email = os.getenv("FROM_EMAIL", "hr@company.com")
            ok = False
            if email_api_key:
                ok = send_email_sendgrid(c.email, subject, body, from_email, email_api_key)
            if not ok and os.getenv("SMTP_HOST"):
                ok = send_email_smtp(c.email, subject, body, from_email,
                    os.getenv("SMTP_HOST"), int(os.getenv("SMTP_PORT","465")),
                    os.getenv("SMTP_USER",""), os.getenv("SMTP_PASS",""))

            if ok:
                c.email_sent = True
                c.email_sent_at = datetime.utcnow()
                sent += 1
            else:
                failed += 1
        except Exception as e:
            print(f"Email error for {c.email}: {e}")
            failed += 1

    await db.commit()
    return {"sent": sent, "failed": failed, "total": sent + failed}
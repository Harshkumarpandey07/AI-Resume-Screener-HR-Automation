from sqlalchemy import Column, String, Text, DateTime, Integer, Boolean, Float, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base
from datetime import datetime
import json

class Candidate(Base):
    __tablename__ = "candidates"
    id = Column(String, primary_key=True)
    name = Column(String(200), nullable=False)
    email = Column(String(200))
    position = Column(String(200))
    job_id = Column(String, ForeignKey("jobs.id"), nullable=True)
    score = Column(Integer, default=0)
    decision = Column(String(20))  # ACCEPT | INTERVIEW | REJECT
    strengths_json = Column(Text, default="[]")
    missing_json = Column(Text, default="[]")
    recommendation = Column(Text)
    resume_text = Column(Text)
    years_experience = Column(Float, nullable=True)
    education = Column(String(200))
    email_sent = Column(Boolean, default=False)
    email_sent_at = Column(DateTime, nullable=True)
    screened_at = Column(DateTime, default=datetime.utcnow)
    job = relationship("Job", back_populates="candidates")

    @property
    def strengths(self): return json.loads(self.strengths_json or "[]")
    @strengths.setter
    def strengths(self, v): self.strengths_json = json.dumps(v)
    @property
    def missing(self): return json.loads(self.missing_json or "[]")
    @missing.setter
    def missing(self, v): self.missing_json = json.dumps(v)
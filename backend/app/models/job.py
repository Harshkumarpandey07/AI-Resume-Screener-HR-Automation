from sqlalchemy import Column, String, Text, DateTime, Integer
from sqlalchemy.orm import relationship
from app.database import Base
from datetime import datetime
import json

class Job(Base):
    __tablename__ = "jobs"
    id = Column(String, primary_key=True)
    title = Column(String(200), nullable=False)
    department = Column(String(100))
    location = Column(String(100))
    description = Column(Text, nullable=False)
    skills_json = Column(Text, default="[]")
    candidate_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    candidates = relationship("Candidate", back_populates="job")

    @property
    def skills(self): return json.loads(self.skills_json or "[]")
    @skills.setter
    def skills(self, v): self.skills_json = json.dumps(v)
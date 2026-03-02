import json, os, re
import anthropic

client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY", ""))

def screen_resume(resume_text: str, job_description: str, job_title: str,
                  threshold: int = 70, model: str = "claude-sonnet-4-20250514") -> dict:
    prompt = f"""You are a world-class HR screening AI. Analyze the resume against the job description.

JOB TITLE: {job_title}

JOB DESCRIPTION:
{job_description}

RESUME:
{resume_text[:4500]}

SCORING RULES:
- 80-100: Exceptional fit — ACCEPT
- {threshold}-79: Good fit — ACCEPT  
- {threshold-20}-{threshold-1}: Moderate fit — INTERVIEW
- 0-{threshold-21}: Poor fit — REJECT

Respond ONLY with valid JSON, no markdown:
{{
  "candidate_name": "string",
  "candidate_email": "string",
  "score": integer,
  "decision": "ACCEPT|INTERVIEW|REJECT",
  "strengths": ["string", "string", "string"],
  "missing_skills": ["string", "string"],
  "recommendation": "2-3 sentence professional evaluation",
  "years_experience": number_or_null,
  "education": "string"
}}"""

    msg = client.messages.create(
        model=model,
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}]
    )
    raw = msg.content[0].text
    clean = re.sub(r'```(?:json)?|```', '', raw).strip()
    return json.loads(clean)
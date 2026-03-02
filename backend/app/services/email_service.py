import os, smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from jinja2 import Template

TEMPLATES = {
    "accept": {
        "subject": "Congratulations! You've Been Selected — {{ position }}",
        "body": """Dear {{ name }},

We are thrilled to inform you that after reviewing your application for {{ position }}, 
you have been selected to move forward in our hiring process.

Our HR team will contact you shortly with next steps.

Congratulations!

HR Team — {{ company }}"""
    },
    "interview": {
        "subject": "Interview Invitation — {{ position }} at {{ company }}",
        "body": """Dear {{ name }},

We were impressed with your profile for {{ position }} and would like to invite you for an interview.

Our team will reach out within 2 business days to schedule a convenient time.

Best regards,
HR Team — {{ company }}"""
    },
    "reject": {
        "subject": "Update on Your Application — {{ position }}",
        "body": """Dear {{ name }},

Thank you for applying for {{ position }} at {{ company }}.

After careful review, we will not be moving forward at this time.
We wish you the best in your career journey.

Kind regards,
HR Team — {{ company }}"""
    }
}

def render_email(template_type: str, variables: dict) -> tuple[str, str]:
    t = TEMPLATES.get(template_type, TEMPLATES["reject"])
    subject = Template(t["subject"]).render(**variables)
    body = Template(t["body"]).render(**variables)
    return subject, body

def send_email_smtp(to_email: str, subject: str, body: str,
                    from_email: str, smtp_host: str, smtp_port: int,
                    smtp_user: str, smtp_pass: str) -> bool:
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = from_email
        msg["To"] = to_email
        msg.attach(MIMEText(body, "plain"))
        with smtplib.SMTP_SSL(smtp_host, smtp_port) as server:
            server.login(smtp_user, smtp_pass)
            server.sendmail(from_email, to_email, msg.as_string())
        return True
    except Exception as e:
        print(f"Email error: {e}")
        return False

def send_email_sendgrid(to_email: str, subject: str, body: str,
                         from_email: str, api_key: str) -> bool:
    try:
        import sendgrid
        from sendgrid.helpers.mail import Mail
        sg = sendgrid.SendGridAPIClient(api_key=api_key)
        message = Mail(from_email=from_email, to_emails=to_email, subject=subject, plain_text_content=body)
        response = sg.send(message)
        return response.status_code in (200, 202)
    except Exception as e:
        print(f"SendGrid error: {e}")
        return False
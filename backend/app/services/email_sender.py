from email.message import EmailMessage
import smtplib

from app.config import get_settings


settings = get_settings()


def send_email(to_email: str, subject: str, body: str) -> bool:
    if not settings.SMTP_HOST or not settings.SMTP_FROM_EMAIL:
        return False

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = settings.SMTP_FROM_EMAIL
    message["To"] = to_email
    message.set_content(body)

    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as smtp:
        if settings.SMTP_USE_TLS:
            smtp.starttls()
        if settings.SMTP_USERNAME:
            smtp.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD or "")
        smtp.send_message(message)
    return True

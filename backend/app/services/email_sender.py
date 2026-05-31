from azure.communication.email import EmailClient

from app.config import get_settings


settings = get_settings()


def send_email(to_email: str, subject: str, body: str, html_body: str | None = None) -> bool:
    if not settings.ACS_CONNECTION_STRING or not settings.SMTP_FROM_EMAIL:
        return False

    client = EmailClient.from_connection_string(settings.ACS_CONNECTION_STRING)
    poller = client.begin_send(
        {
            "senderAddress": settings.SMTP_FROM_EMAIL,
            "recipients": {"to": [{"address": to_email}]},
            "content": {
                "subject": subject,
                "plainText": body,
                **({"html": html_body} if html_body else {}),
            },
        }
    )
    poller.result()
    return True

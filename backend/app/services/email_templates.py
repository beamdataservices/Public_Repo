from datetime import datetime
from html import escape

from app.config import get_settings


settings = get_settings()


def _logo_url() -> str:
    if settings.EMAIL_LOGO_URL:
        return settings.EMAIL_LOGO_URL
    return f"{settings.FRONTEND_BASE_URL.rstrip('/')}/beam-full-logo-20260513.png"


def _formatted_expiry(expires_at: datetime) -> str:
    return expires_at.strftime("%B %d, %Y at %I:%M %p UTC")


def _layout(*, heading: str, intro: str, action_label: str, action_url: str, expiry_text: str) -> str:
    safe_url = escape(action_url, quote=True)
    return f"""\
<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f4f7fb;font-family:Arial,Helvetica,sans-serif;color:#172033;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f7fb;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #dbe5f0;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="background:#002b5b;padding:24px 32px;color:#ffffff;">
                <div style="font-size:22px;font-weight:700;letter-spacing:.2px;">BEAM Analytics</div>
                <div style="margin-top:5px;font-size:13px;color:#c8e8f7;">Data Quality Platform</div>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <h1 style="margin:0 0 16px;font-size:24px;line-height:1.25;color:#002b5b;">{escape(heading)}</h1>
                <p style="margin:0 0 22px;font-size:15px;line-height:1.65;color:#44546a;">{escape(intro)}</p>
                <table role="presentation" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="border-radius:8px;background:#00a3e0;">
                      <a href="{safe_url}" style="display:inline-block;padding:13px 22px;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;">{escape(action_label)}</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:22px 0 0;font-size:13px;line-height:1.55;color:#64748b;">{escape(expiry_text)}</p>
                <p style="margin:18px 0 0;font-size:12px;line-height:1.55;color:#7b8798;">If the button does not work, paste this link into your browser:<br><a href="{safe_url}" style="color:#007da8;word-break:break-all;">{safe_url}</a></p>
              </td>
            </tr>
            <tr>
              <td align="center" style="border-top:1px solid #e6edf5;padding:22px 32px 26px;">
                <img src="{escape(_logo_url(), quote=True)}" alt="BEAM Data Services" width="190" style="display:block;width:190px;max-width:100%;height:auto;">
                <p style="margin:14px 0 0;font-size:11px;line-height:1.5;color:#8b98a8;">This automated message was sent by BEAM Analytics.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
"""


def password_reset_email(reset_url: str, expires_at: datetime) -> tuple[str, str]:
    expiry = _formatted_expiry(expires_at)
    plain_text = (
        "A password reset was requested for your BEAM Analytics account.\n\n"
        f"Reset your password: {reset_url}\n\n"
        f"This link expires {expiry}. "
        "If you did not request this reset, you can ignore this email."
    )
    html = _layout(
        heading="Reset your BEAM Analytics password",
        intro="A password reset was requested for your BEAM Analytics account.",
        action_label="Reset Password",
        action_url=reset_url,
        expiry_text=f"This link expires {expiry}. If you did not request this reset, you can safely ignore this email.",
    )
    return plain_text, html


def invitation_email(invite_url: str, expires_at: datetime) -> tuple[str, str]:
    expiry = _formatted_expiry(expires_at)
    plain_text = (
        "You have been invited to join a BEAM Analytics account.\n\n"
        f"Create your account: {invite_url}\n\n"
        f"This invitation expires {expiry}."
    )
    html = _layout(
        heading="You have been invited to BEAM Analytics",
        intro="An account owner has invited you to join their BEAM Analytics account.",
        action_label="Create Your Account",
        action_url=invite_url,
        expiry_text=f"This invitation expires {expiry}.",
    )
    return plain_text, html

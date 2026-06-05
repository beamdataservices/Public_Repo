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


def _layout(
    *,
    heading: str,
    intro: str,
    action_label: str,
    action_url: str,
    expiry_text: str,
    extra_html: str = "",
) -> str:
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
                {extra_html}
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


def welcome_email(account_name: str, dashboard_url: str) -> tuple[str, str]:
    safe_account_name = account_name.strip() or "your account"
    survey_url = settings.FEEDBACK_SURVEY_URL or "#"
    plain_text = (
        f"Welcome to BEAM Analytics, and thanks for creating {safe_account_name}.\n\n"
        "BEAM Analytics helps you upload CSV and Excel files, review data quality, generate practical insights, "
        "build charts, save reports, and manage account access from one workspace.\n\n"
        "Your current workspace includes file upload, data health checks, charting, saved reports, recycle bin recovery, "
        "and account/user controls. A future premium tier is planned to include expanded AI usage, higher limits, deeper "
        "reporting workflows, priority support, and more advanced team/admin controls.\n\n"
        "We are actively improving the product and genuinely appreciate feedback. When available, you can share feedback here:\n"
        f"{survey_url}\n\n"
        f"Open your dashboard: {dashboard_url}\n\n"
        "Thank you for trying BEAM Analytics."
    )
    extra_html = f"""
                <div style="margin:24px 0 0;padding:18px;border:1px solid #dbe5f0;border-radius:12px;background:#f8fbff;">
                  <p style="margin:0 0 10px;font-size:14px;line-height:1.6;color:#334155;"><strong>What you can do today</strong></p>
                  <ul style="margin:0;padding-left:18px;font-size:13px;line-height:1.7;color:#44546a;">
                    <li>Upload CSV and Excel files for fast review.</li>
                    <li>Run data health checks to find missing values, duplicates, formatting issues, and outliers.</li>
                    <li>Explore charts, save reports, and restore deleted files from the recycle bin.</li>
                    <li>Invite users and manage account access from the Add Users page.</li>
                  </ul>
                </div>
                <div style="margin:18px 0 0;padding:18px;border:1px solid #c7edf8;border-radius:12px;background:#effaff;">
                  <p style="margin:0 0 8px;font-size:14px;line-height:1.6;color:#002b5b;"><strong>Planned premium capabilities</strong></p>
                  <p style="margin:0;font-size:13px;line-height:1.7;color:#44546a;">Premium tiers are planned to offer expanded AI usage, higher file and reporting limits, deeper workflow support, priority help, and more advanced team controls.</p>
                </div>
                <p style="margin:20px 0 0;font-size:13px;line-height:1.65;color:#44546a;">We are actively improving BEAM Analytics and would sincerely appreciate your feedback. When the survey is available, you can share it here: <a href="{escape(survey_url, quote=True)}" style="color:#007da8;">feedback survey</a>.</p>
"""
    html = _layout(
        heading="Welcome to BEAM Analytics",
        intro=f"Thanks for creating {safe_account_name}. We are glad to have you here.",
        action_label="Open Dashboard",
        action_url=dashboard_url,
        expiry_text="You can start by uploading a CSV or Excel file, then reviewing your data health and building your first report.",
        extra_html=extra_html,
    )
    return plain_text, html

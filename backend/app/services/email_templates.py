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
        "Start by uploading a CSV or Excel file. BEAM will help you understand data quality, spot issues, "
        "build charts, save reports, and collaborate from one workspace.\n\n"
        "Your Demo account is ready now. When you need more room, Premium will unlock higher file and reporting limits, "
        "expanded AI usage, deeper workflow support, priority help, and more advanced team controls.\n\n"
        "Your feedback will shape what we build next. When available, you can share feedback here:\n"
        f"{survey_url}\n\n"
        f"Get started now: {dashboard_url}\n\n"
        "Thank you for trying BEAM Analytics. We are glad you are here."
    )
    extra_html = f"""
                <div style="margin:24px 0 0;padding:20px;border:1px solid #dbe5f0;border-radius:14px;background:#f8fbff;">
                  <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#334155;"><strong>Your first three steps</strong></p>
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                    <tr>
                      <td valign="top" width="28" style="padding:0 10px 12px 0;"><span style="display:inline-block;width:24px;height:24px;border-radius:999px;background:#00a3e0;color:#ffffff;text-align:center;line-height:24px;font-size:12px;font-weight:700;">1</span></td>
                      <td style="padding:0 0 12px;font-size:13px;line-height:1.6;color:#44546a;"><strong>Upload a file.</strong> Start with a CSV or Excel file you already use.</td>
                    </tr>
                    <tr>
                      <td valign="top" width="28" style="padding:0 10px 12px 0;"><span style="display:inline-block;width:24px;height:24px;border-radius:999px;background:#00a3e0;color:#ffffff;text-align:center;line-height:24px;font-size:12px;font-weight:700;">2</span></td>
                      <td style="padding:0 0 12px;font-size:13px;line-height:1.6;color:#44546a;"><strong>Review data health.</strong> See missing values, duplicates, formatting issues, and outliers in plain English.</td>
                    </tr>
                    <tr>
                      <td valign="top" width="28" style="padding:0 10px 0 0;"><span style="display:inline-block;width:24px;height:24px;border-radius:999px;background:#00a3e0;color:#ffffff;text-align:center;line-height:24px;font-size:12px;font-weight:700;">3</span></td>
                      <td style="padding:0;font-size:13px;line-height:1.6;color:#44546a;"><strong>Build and save insights.</strong> Explore charts, create reports, and invite teammates when you are ready.</td>
                    </tr>
                  </table>
                </div>
                <div style="margin:18px 0 0;padding:20px;border:1px solid #b8e9f7;border-radius:14px;background:#effaff;">
                  <p style="margin:0 0 8px;font-size:14px;line-height:1.6;color:#002b5b;"><strong>When you are ready to grow</strong></p>
                  <p style="margin:0 0 14px;font-size:13px;line-height:1.7;color:#44546a;">Premium is designed for teams that need more space, more AI support, stronger reporting workflows, priority help, and advanced account controls.</p>
                  <a href="{escape(dashboard_url, quote=True)}" style="display:inline-block;border-radius:8px;background:#002b5b;padding:11px 16px;color:#ffffff;text-decoration:none;font-size:13px;font-weight:700;">Explore BEAM Analytics</a>
                </div>
                <p style="margin:20px 0 0;font-size:13px;line-height:1.65;color:#44546a;">We are actively improving BEAM Analytics, and your feedback matters. When the survey is available, you can share quick feedback here: <a href="{escape(survey_url, quote=True)}" style="color:#007da8;">feedback survey</a>.</p>
"""
    html = _layout(
        heading="Welcome to BEAM Analytics",
        intro=f"{safe_account_name} is ready. Upload your first file to start finding data quality issues, charts, and useful insights in minutes.",
        action_label="Start Analyzing Data",
        action_url=dashboard_url,
        expiry_text="Tip: choose a CSV or Excel file you already trust, then use the Data Health tab to see what needs attention.",
        extra_html=extra_html,
    )
    return plain_text, html


def premium_subscription_email(account_name: str, dashboard_url: str) -> tuple[str, str]:
    safe_account_name = account_name.strip() or "your account"
    plain_text = (
        "Thank you for upgrading to BEAM Analytics Premium.\n\n"
        f"Premium is now active for {safe_account_name}. Your account has expanded room for files, reporting, users, "
        "and included monthly AI usage while keeping the same workspace and data already in BEAM.\n\n"
        "Your subscription was processed securely through Stripe. You can manage billing, invoices, and payment details "
        "from Account Billing in BEAM Analytics.\n\n"
        f"Open Account Billing: {dashboard_url}\n\n"
        "We appreciate your trust and are excited to keep improving BEAM Analytics with you."
    )
    extra_html = """
                <div style="margin:24px 0 0;padding:20px;border:1px solid #b8e9f7;border-radius:14px;background:#effaff;">
                  <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#002b5b;"><strong>Premium is now active</strong></p>
                  <ul style="margin:0;padding-left:18px;font-size:13px;line-height:1.8;color:#44546a;">
                    <li>Expanded file and reporting capacity for your account.</li>
                    <li>Included monthly AI usage for summaries, explanations, and chat.</li>
                    <li>More room for team collaboration and account workflows.</li>
                    <li>Access to billing management, invoices, and payment details through Account Billing.</li>
                  </ul>
                </div>
                <p style="margin:20px 0 0;font-size:13px;line-height:1.65;color:#44546a;">Your subscription was processed securely through Stripe. Thank you for trusting BEAM Analytics as we continue building a better data quality platform for teams.</p>
"""
    html = _layout(
        heading="Thank you for upgrading to Premium",
        intro=f"Premium is now active for {safe_account_name}. We appreciate your trust and are excited to support your next stage of data quality work.",
        action_label="Open Account Billing",
        action_url=dashboard_url,
        expiry_text="You can manage your subscription, invoices, and payment details from Account Billing anytime.",
        extra_html=extra_html,
    )
    return plain_text, html

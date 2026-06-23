"""Brevo邮件发送服务（SMTP）

配置环境变量：
- BREVO_SMTP_HOST: SMTP主机（默认 smtp-relay.brevo.com）
- BREVO_SMTP_PORT: SMTP端口（默认 587）
- BREVO_SMTP_USER: Brevo SMTP用户名（即API key login）
- BREVO_SMTP_PASSWORD: Brevo SMTP密码（即API key）
- BREVO_SENDER_EMAIL: 发件人邮箱（需在Brevo验证）
- BREVO_SENDER_NAME: 发件人名称
- APP_BASE_URL: 应用基础URL（用于重置密码链接）
"""
import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv

load_dotenv()

BREVO_SMTP_HOST = os.getenv("BREVO_SMTP_HOST", "smtp-relay.brevo.com")
BREVO_SMTP_PORT = int(os.getenv("BREVO_SMTP_PORT", "587"))
BREVO_SMTP_USER = os.getenv("BREVO_SMTP_USER", "")
BREVO_SMTP_PASSWORD = os.getenv("BREVO_SMTP_PASSWORD", "")
BREVO_SENDER_EMAIL = os.getenv("BREVO_SENDER_EMAIL", "noreply@jobhunt.local")
BREVO_SENDER_NAME = os.getenv("BREVO_SENDER_NAME", "求职助手")
APP_BASE_URL = os.getenv("APP_BASE_URL", "http://localhost:5173")


def is_configured() -> bool:
    """检查Brevo是否已配置"""
    return bool(BREVO_SMTP_USER and BREVO_SMTP_PASSWORD)


def send_email(to_email: str, subject: str, html_content: str) -> bool:
    """发送HTML邮件，返回是否成功"""
    if not is_configured():
        print(f"[Email] Brevo未配置，跳过发送邮件到 {to_email}: {subject}")
        return False

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{BREVO_SENDER_NAME} <{BREVO_SENDER_EMAIL}>"
    msg["To"] = to_email
    msg.attach(MIMEText(html_content, "html", "utf-8"))

    try:
        with smtplib.SMTP(BREVO_SMTP_HOST, BREVO_SMTP_PORT) as server:
            server.starttls()
            server.login(BREVO_SMTP_USER, BREVO_SMTP_PASSWORD)
            server.sendmail(BREVO_SENDER_EMAIL, to_email, msg.as_string())
        return True
    except Exception as e:
        print(f"[Email] 发送失败: {e}")
        return False


def send_verification_email(to_email: str, code: str) -> bool:
    """发送邮箱验证码"""
    html = f"""
    <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #4f46e5;">邮箱验证</h2>
        <p>你的验证码是：</p>
        <div style="font-size: 32px; font-weight: bold; letter-spacing: 4px; color: #4f46e5;
                    background: #eef2ff; padding: 16px; border-radius: 8px; text-align: center; margin: 16px 0;">
            {code}
        </div>
        <p style="color: #6b7280; font-size: 14px;">验证码15分钟内有效。如非本人操作，请忽略此邮件。</p>
    </div>
    """
    return send_email(to_email, "【求职助手】邮箱验证码", html)


def send_reset_email(to_email: str, token: str) -> bool:
    """发送密码重置邮件"""
    reset_url = f"{APP_BASE_URL}/reset-password?token={token}"
    html = f"""
    <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #4f46e5;">重置密码</h2>
        <p>你正在重置求职助手账号的密码，请点击下方按钮：</p>
        <a href="{reset_url}"
           style="display: inline-block; background: #4f46e5; color: white; padding: 12px 32px;
                  border-radius: 8px; text-decoration: none; font-weight: 500; margin: 16px 0;">
            重置密码
        </a>
        <p style="color: #6b7280; font-size: 14px;">
            或复制此链接到浏览器：<br>{reset_url}
        </p>
        <p style="color: #6b7280; font-size: 14px;">链接30分钟内有效。如非本人操作，请忽略此邮件。</p>
    </div>
    """
    return send_email(to_email, "【求职助手】重置密码", html)

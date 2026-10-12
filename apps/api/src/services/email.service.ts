import nodemailer from "nodemailer";

// ─── Transport ────────────────────────────────────────────────────────────────

function getTransport() {
  const host = process.env["SMTP_HOST"];
  const port = parseInt(process.env["SMTP_PORT"] ?? "587");
  const user = process.env["SMTP_USER"];
  const pass = process.env["SMTP_PASS"];

  // Dev mode: use Ethereal (catch-all SMTP) if no real config
  if (!host || !user || !pass) {
    if (process.env["NODE_ENV"] === "production") {
      throw new Error("SMTP_HOST, SMTP_USER, SMTP_PASS are required in production.");
    }
    // Return null — emails will be logged to console in dev
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

const FROM = process.env["EMAIL_FROM"] ?? "BotForge <noreply@botforge.dev>";
const APP_URL = process.env["FRONTEND_URL"] ?? "http://localhost:3000";

// ─── Email service ────────────────────────────────────────────────────────────

export const emailService = {
  async sendVerificationEmail(to: string, displayName: string, token: string): Promise<void> {
    const link = `${APP_URL}/verify-email?token=${token}`;
    await send({
      to,
      subject: "Verify your BotForge email",
      html: template("Verify your email", `
        <p>Hi ${displayName},</p>
        <p>Click the button below to verify your email address.</p>
        <p style="text-align:center;margin:32px 0">
          <a href="${link}" style="${btnStyle}">Verify Email</a>
        </p>
        <p style="color:#94a3b8;font-size:13px">This link expires in 24 hours. If you didn't create a BotForge account, you can ignore this email.</p>
      `),
    });
  },

  async sendPasswordResetEmail(to: string, displayName: string, token: string): Promise<void> {
    const link = `${APP_URL}/reset-password?token=${token}`;
    await send({
      to,
      subject: "Reset your BotForge password",
      html: template("Reset your password", `
        <p>Hi ${displayName},</p>
        <p>We received a request to reset your password. Click the button below to choose a new one.</p>
        <p style="text-align:center;margin:32px 0">
          <a href="${link}" style="${btnStyle}">Reset Password</a>
        </p>
        <p style="color:#94a3b8;font-size:13px">This link expires in 1 hour. If you didn't request a reset, you can ignore this email.</p>
      `),
    });
  },

  async sendWelcomeEmail(to: string, displayName: string): Promise<void> {
    await send({
      to,
      subject: "Welcome to BotForge",
      html: template("Welcome to BotForge 🚀", `
        <p>Hi ${displayName},</p>
        <p>Your account is ready. Here's how to get started:</p>
        <ol style="color:#cbd5e1;padding-left:20px;line-height:1.8">
          <li>Create your first bot from the dashboard</li>
          <li>Add a Discord bot token from the Developer Portal</li>
          <li>Enable modules like Welcome Messages or Auto-Role</li>
          <li>Click Deploy — your bot is live in seconds</li>
        </ol>
        <p style="text-align:center;margin:32px 0">
          <a href="${APP_URL}/dashboard" style="${btnStyle}">Go to Dashboard</a>
        </p>
      `),
    });
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function send(opts: { to: string; subject: string; html: string }) {
  const transport = getTransport();

  if (!transport) {
    // Dev fallback — log to console
    console.log(`[email] To: ${opts.to} | Subject: ${opts.subject}`);
    console.log(`[email] (No SMTP configured — email not sent in dev)`);
    return;
  }

  await transport.sendMail({ from: FROM, ...opts });
}

const btnStyle = [
  "display:inline-block",
  "background:#4f46e5",
  "color:#ffffff",
  "text-decoration:none",
  "padding:12px 24px",
  "border-radius:8px",
  "font-weight:600",
  "font-size:14px",
].join(";");

function template(title: string, body: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:system-ui,sans-serif;color:#e2e8f0">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 16px">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#1e293b;border-radius:12px;overflow:hidden">
        <tr>
          <td style="background:#4f46e5;padding:24px 32px">
            <span style="font-size:20px;font-weight:700;color:#fff">⚡ BotForge</span>
          </td>
        </tr>
        <tr>
          <td style="padding:32px">
            <h1 style="margin:0 0 20px;font-size:22px;color:#f1f5f9">${title}</h1>
            ${body}
          </td>
        </tr>
        <tr>
          <td style="padding:20px 32px;border-top:1px solid #334155">
            <p style="margin:0;font-size:12px;color:#64748b">
              © ${new Date().getFullYear()} BotForge. You're receiving this because you have an account.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

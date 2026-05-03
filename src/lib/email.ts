import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_SERVER_HOST,
  port: Number(process.env.EMAIL_SERVER_PORT ?? 587),
  secure: false,
  auth: {
    user: process.env.EMAIL_SERVER_USER,
    pass: process.env.EMAIL_SERVER_PASSWORD,
  },
});

export async function sendInviteEmail(opts: {
  to: string;
  hotelName: string;
  hotelCity: string;
  role: "MANAGER" | "VIEWER";
  inviteUrl: string;
  expiresInDays?: number;
}) {
  const { to, hotelName, hotelCity, role, inviteUrl, expiresInDays = 7 } = opts;
  const roleLabel = role === "MANAGER" ? "Manager" : "Viewer";
  const from = process.env.EMAIL_FROM ?? "Hotel Profit <hotelprofitmaster@gmail.com>";

  await transporter.sendMail({
    from,
    to,
    subject: `Meghívó — ${hotelName} csapata vár!`,
    text: `Meghívtak a(z) ${hotelName} (${hotelCity}) csapatába ${roleLabel} szerepkörrel.\n\nFogadd el a meghívót: ${inviteUrl}\n\nA link ${expiresInDays} napig érvényes.`,
    html: `
<!DOCTYPE html>
<html lang="hu">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F1F5F9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F1F5F9;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#7C3AED,#5B21B6);padding:32px 40px;text-align:center;">
            <div style="width:48px;height:48px;background:rgba(255,255,255,0.15);border-radius:14px;display:inline-flex;align-items:center;justify-content:center;margin-bottom:12px;">
              <span style="font-size:24px;">📈</span>
            </div>
            <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">Hotel Profit</h1>
            <p style="margin:6px 0 0;color:rgba(255,255,255,0.7);font-size:13px;">Profit tervezés és elemzés</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 40px;">
            <h2 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#0F172A;">Csapati meghívó 🎉</h2>
            <p style="margin:0 0 24px;font-size:15px;color:#475569;line-height:1.6;">
              Meghívtak a(z) <strong style="color:#0F172A;">${hotelName}</strong> csapatába.
            </p>

            <!-- Hotel card -->
            <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:14px;padding:20px;margin-bottom:28px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="width:44px;vertical-align:top;">
                    <div style="width:44px;height:44px;background:#EDE9FE;border-radius:12px;text-align:center;line-height:44px;font-size:20px;">🏨</div>
                  </td>
                  <td style="padding-left:14px;vertical-align:top;">
                    <p style="margin:0;font-size:16px;font-weight:700;color:#0F172A;">${hotelName}</p>
                    <p style="margin:2px 0 0;font-size:13px;color:#64748B;">${hotelCity}</p>
                  </td>
                  <td style="text-align:right;vertical-align:top;">
                    <span style="display:inline-block;background:#EDE9FE;color:#7C3AED;font-size:12px;font-weight:700;padding:4px 12px;border-radius:8px;">${roleLabel}</span>
                  </td>
                </tr>
              </table>
            </div>

            <!-- CTA button -->
            <div style="text-align:center;margin-bottom:24px;">
              <a href="${inviteUrl}"
                style="display:inline-block;background:linear-gradient(135deg,#7C3AED,#5B21B6);color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:14px 36px;border-radius:12px;">
                Meghívó elfogadása →
              </a>
            </div>

            <p style="margin:0;font-size:12px;color:#94A3B8;text-align:center;">
              A link <strong>${expiresInDays} napig</strong> érvényes. Ha nem te kaptad ezt az emailt, hagyd figyelmen kívül.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#F8FAFC;padding:20px 40px;border-top:1px solid #E2E8F0;text-align:center;">
            <p style="margin:0;font-size:12px;color:#94A3B8;">
              Hotel Profit · hotelprofitmaster@gmail.com
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`,
  });
}

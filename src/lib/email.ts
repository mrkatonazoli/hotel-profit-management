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
  role: "MANAGER" | "PROFESSIONAL";
  inviteUrl: string;
  expiresInDays?: number;
}) {
  const { to, hotelName, hotelCity, role, inviteUrl, expiresInDays = 7 } = opts;
  const roleLabel = role === "MANAGER" ? "Manager" : "Professional";
  const from = process.env.EMAIL_FROM ?? "HeyMax! <hello@heymax.app>";

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
          <td style="background:linear-gradient(150deg,#153251,#09203A);padding:32px 40px;text-align:center;">
            <div style="margin-bottom:14px;">
              <span style="font-family:'Segoe UI',Arial,sans-serif;font-size:22px;letter-spacing:-0.02em;">
                <span style="font-weight:500;color:#AEB9C8;">Hey</span><span style="font-weight:700;color:#FFFFFF;">Max</span><span style="color:#35BD78;">!</span>
              </span>
            </div>
            <h1 style="margin:0;color:#F8FAFC;font-size:20px;font-weight:700;">Csapati meghívó</h1>
            <p style="margin:6px 0 0;color:rgba(255,255,255,0.5);font-size:13px;">Profit tervezés és elemzés</p>
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
                    <div style="width:44px;height:44px;background:rgba(53,189,120,0.12);border-radius:12px;text-align:center;line-height:44px;font-size:20px;">🏨</div>
                  </td>
                  <td style="padding-left:14px;vertical-align:top;">
                    <p style="margin:0;font-size:16px;font-weight:700;color:#0F172A;">${hotelName}</p>
                    <p style="margin:2px 0 0;font-size:13px;color:#64748B;">${hotelCity}</p>
                  </td>
                  <td style="text-align:right;vertical-align:top;">
                    <span style="display:inline-block;background:rgba(53,189,120,0.12);color:#35BD78;font-size:12px;font-weight:700;padding:4px 12px;border-radius:8px;">${roleLabel}</span>
                  </td>
                </tr>
              </table>
            </div>

            <!-- CTA button -->
            <div style="text-align:center;margin-bottom:24px;">
              <a href="${inviteUrl}"
                style="display:inline-block;background:linear-gradient(135deg,#35BD78,#03915A);color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:14px 36px;border-radius:12px;box-shadow:0 4px 14px rgba(53,189,120,0.35);">
                Meghívó elfogadása →
              </a>
            </div>

            <p style="margin:0;font-size:12px;color:#94A3B8;text-align:center;">
              A link <strong>${expiresInDays} napig</strong> érvényes. Ha nem te kaptad ezt az e-mailt, hagyd figyelmen kívül.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#F8FAFC;padding:20px 40px;border-top:1px solid #E2E8F0;text-align:center;">
            <p style="margin:0;font-size:12px;color:#94A3B8;">HeyMax! · Profit tervezés és elemzés</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`,
  });
}

export async function sendHotelRequestEmail(opts: {
  requesterName: string | null;
  requesterEmail: string;
  hotelName: string;
}) {
  const { requesterName, requesterEmail, hotelName } = opts;
  const adminEmail = process.env.ADMIN_EMAIL ?? process.env.EMAIL_FROM ?? "katonazoltanads@gmail.com";
  const from = process.env.EMAIL_FROM ?? "HeyMax! <hello@heymax.app>";
  const displayName = requesterName ?? requesterEmail;
  const now = new Date().toLocaleString("hu-HU", { timeZone: "Europe/Budapest" });

  await transporter.sendMail({
    from,
    to: adminEmail,
    subject: `🏨 Új szálloda igény: ${hotelName}`,
    text: `Új szálloda felvételi igény érkezett.\n\nSzálloda neve: ${hotelName}\nKérte: ${displayName} (${requesterEmail})\nIdőpont: ${now}`,
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
          <td style="background:linear-gradient(150deg,#153251,#09203A);padding:32px 40px;text-align:center;">
            <div style="margin-bottom:12px;">
              <span style="font-family:'Segoe UI',Arial,sans-serif;font-size:22px;letter-spacing:-0.02em;">
                <span style="font-weight:500;color:#AEB9C8;">Hey</span><span style="font-weight:700;color:#FFFFFF;">Max</span><span style="color:#35BD78;">!</span>
              </span>
            </div>
            <h1 style="margin:0;color:#F8FAFC;font-size:20px;font-weight:700;">Új szálloda felvételi igény</h1>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 40px;">

            <!-- Hotel card -->
            <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:14px;padding:20px;margin-bottom:24px;">
              <p style="margin:0 0 4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#94A3B8;">Szálloda neve</p>
              <p style="margin:0;font-size:22px;font-weight:800;color:#0F172A;">${hotelName}</p>
            </div>

            <!-- Requester card -->
            <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:14px;padding:20px;margin-bottom:24px;">
              <p style="margin:0 0 4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#94A3B8;">Kérte</p>
              <p style="margin:0;font-size:16px;font-weight:700;color:#0F172A;">${displayName}</p>
              <p style="margin:2px 0 0;font-size:13px;color:#64748B;">${requesterEmail}</p>
            </div>

            <p style="margin:0;font-size:12px;color:#94A3B8;text-align:center;">
              Beküldve: ${now}
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#F8FAFC;padding:20px 40px;border-top:1px solid #E2E8F0;text-align:center;">
            <p style="margin:0;font-size:12px;color:#94A3B8;">HeyMax! · Rendszerértesítő</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`,
  });
}

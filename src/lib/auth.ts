import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Nodemailer from "next-auth/providers/nodemailer";
import { prisma } from "./prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "database" },
  pages: {
    signIn: "/login",
    verifyRequest: "/login/verify",
  },
  providers: [
    Nodemailer({
      server: {
        host: process.env.EMAIL_SERVER_HOST,
        port: Number(process.env.EMAIL_SERVER_PORT),
        auth: {
          user: process.env.EMAIL_SERVER_USER,
          pass: process.env.EMAIL_SERVER_PASSWORD,
        },
      },
      from: process.env.EMAIL_FROM,
      generateVerificationToken() {
        // 6-digit numeric OTP
        return String(Math.floor(100000 + Math.random() * 900000));
      },
      sendVerificationRequest: async ({ identifier: email, token, url, provider }) => {
        const { createTransport } = await import("nodemailer");
        const transport = createTransport(provider.server as Record<string, unknown>);
        await transport.sendMail({
          to: email,
          from: provider.from,
          subject: "Bejelentkezési kód – Hotel Profit",
          text: `A bejelentkezési kódod: ${token}\n\nA kód 10 percig érvényes.\n\nAlternatívaként kattints erre a linkre: ${url}`,
          html: `
            <div style="font-family: 'Plus Jakarta Sans', Arial, sans-serif; max-width: 480px; margin: 0 auto; background: #F1F5F9; padding: 40px 24px;">
              <div style="background: #0F172A; border-radius: 16px; padding: 40px; text-align: center;">
                <div style="color: #7C3AED; font-size: 13px; font-weight: 600; letter-spacing: 2px; margin-bottom: 8px;">HOTEL PROFIT</div>
                <h1 style="color: #F8FAFC; font-size: 22px; font-weight: 700; margin: 0 0 8px;">Bejelentkezési kód</h1>
                <p style="color: #94A3B8; font-size: 14px; margin: 0 0 32px;">Add meg ezt a kódot a bejelentkezési oldalon</p>
                <div style="background: #1E293B; border: 1px solid #334155; border-radius: 12px; padding: 24px; margin-bottom: 32px;">
                  <div style="color: #F8FAFC; font-size: 40px; font-weight: 800; letter-spacing: 12px; font-variant-numeric: tabular-nums;">${token}</div>
                </div>
                <p style="color: #64748B; font-size: 12px; margin: 0;">A kód 10 percig érvényes. Ha nem te kérted, hagyd figyelmen kívül.</p>
              </div>
            </div>
          `,
        });
      },
    }),
  ],
  callbacks: {
    session({ session, user }) {
      session.user.id = user.id;
      return session;
    },
  },
});

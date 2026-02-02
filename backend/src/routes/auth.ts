import { Router, Request, Response } from "express";
import { prisma } from "../db";
import {
  signToken,
  verifyToken,
  generateOtpCode,
  setOtp,
  consumeOtp,
} from "../auth";

const router = Router();

/** POST /auth/otp/send – send OTP to email (stub: no real email, returns success). */
router.post("/otp/send", async (req: Request, res: Response) => {
  const email = (req.body?.email as string)?.trim();
  if (!email) {
    res.status(400).json({ error: "email required" });
    return;
  }
  const code = generateOtpCode();
  setOtp(email, code);
  // TODO: send email with code (e.g. Resend, SendGrid). For MVP we log or stub.
  if (process.env.NODE_ENV === "development") {
    console.log(`[OTP] ${email} -> ${code}`);
  }
  res.json({ ok: true, message: "code_sent" });
});

/** POST /auth/otp/verify – verify OTP and return JWT. */
router.post("/otp/verify", async (req: Request, res: Response) => {
  const email = (req.body?.email as string)?.trim();
  const code = (req.body?.code as string)?.trim();
  if (!email || !code) {
    res.status(400).json({ error: "email and code required" });
    return;
  }
  if (!consumeOtp(email, code)) {
    res.status(401).json({ error: "invalid_or_expired_code" });
    return;
  }
  let user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        status: "active",
        role: "user",
      },
    });
  }
  const token = signToken({
    userId: user.id,
    email: user.email,
    role: user.role,
  });
  res.json({ token, user: { id: user.id, email: user.email, role: user.role } });
});

/** GET /auth/me – return current user from Authorization Bearer token. */
router.get("/me", (req: Request, res: Response) => {
  const auth = req.headers.authorization;
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: "invalid_token" });
    return;
  }
  res.json({ user: payload });
});

/** GET /auth/google – redirect to Google OAuth. */
router.get("/google", (_req: Request, res: Response) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI ?? `${process.env.BACKEND_URL ?? "https://tax-reports-api.onrender.com"}/auth/google/callback`;
  if (!clientId) {
    res.status(501).json({ error: "google_oauth_not_configured" });
    return;
  }
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  res.redirect(url.toString());
});

/** GET /auth/google/callback – exchange code for user, create/find user, redirect to frontend with token. */
router.get("/google/callback", async (req: Request, res: Response) => {
  const code = req.query.code as string;
  const frontendUrl = process.env.FRONTEND_URL ?? "https://tax-reports-web.onrender.com";
  if (!code) {
    res.redirect(`${frontendUrl}/login?error=no_code`);
    return;
  }
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    res.redirect(`${frontendUrl}/login?error=google_not_configured`);
    return;
  }
  const redirectUri = process.env.GOOGLE_REDIRECT_URI ?? `${process.env.BACKEND_URL ?? "https://tax-reports-api.onrender.com"}/auth/google/callback`;
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) {
    res.redirect(`${frontendUrl}/login?error=token_exchange_failed`);
    return;
  }
  const tokens = (await tokenRes.json()) as { access_token: string };
  const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (!userRes.ok) {
    res.redirect(`${frontendUrl}/login?error=userinfo_failed`);
    return;
  }
  const googleUser = (await userRes.json()) as { id: string; email: string };
  let user = await prisma.user.findFirst({
    where: { OR: [{ email: googleUser.email }, { googleId: googleUser.id }] },
  });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: googleUser.email,
        googleId: googleUser.id,
        status: "active",
        role: "user",
      },
    });
  } else if (!user.googleId) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { googleId: googleUser.id },
    });
  }
  const token = signToken({
    userId: user.id,
    email: user.email,
    role: user.role,
  });
  res.redirect(`${frontendUrl}/login?token=${encodeURIComponent(token)}`);
});

export default router;

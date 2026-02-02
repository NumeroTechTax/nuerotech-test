import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-change-in-production";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? "7d";

export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;
    return decoded;
  } catch {
    return null;
  }
}

/** In-memory OTP store (use Redis in production). */
const otpStore = new Map<
  string,
  { code: string; expiresAt: number }
>();

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const OTP_CODE_LENGTH = 6;

export function generateOtpCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function setOtp(email: string, code: string): void {
  otpStore.set(email.toLowerCase(), {
    code,
    expiresAt: Date.now() + OTP_TTL_MS,
  });
}

export function consumeOtp(email: string, code: string): boolean {
  const key = email.toLowerCase();
  const entry = otpStore.get(key);
  if (!entry || entry.expiresAt < Date.now()) return false;
  if (entry.code !== code) return false;
  otpStore.delete(key);
  return true;
}

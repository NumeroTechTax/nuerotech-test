import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../auth";

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
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
  (req as Request & { user: { userId: string; email: string; role: string } }).user = payload;
  next();
}

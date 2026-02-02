import { Request, Response, NextFunction } from "express";

type AuthRequest = Request & { user?: { userId: string; email: string; role: string } };

export function requireRole(role: string) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    if (req.user.role !== role && req.user.role !== "admin") {
      res.status(403).json({ error: "forbidden" });
      return;
    }
    next();
  };
}

export const requireAdmin = requireRole("admin");

/** Allow admin or employee */
export function requireEmployeeOrAdmin(req: AuthRequest, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  if (req.user.role !== "employee" && req.user.role !== "admin") {
    res.status(403).json({ error: "forbidden" });
    return;
  }
  next();
}

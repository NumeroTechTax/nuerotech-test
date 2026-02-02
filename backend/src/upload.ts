import path from "path";
import fs from "fs";

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? path.join(process.cwd(), "uploads");

export function getUploadDir(): string {
  return UPLOAD_DIR;
}

export function getCaseUploadDir(caseId: string): string {
  return path.join(UPLOAD_DIR, "cases", caseId);
}

export function getSignaturesDir(caseId: string): string {
  return path.join(UPLOAD_DIR, "signatures", caseId);
}

export function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function saveBuffer(filePath: string, buffer: Buffer): void {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, buffer);
}

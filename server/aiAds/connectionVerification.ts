import crypto from "node:crypto";
import { ENV } from "../_core/env";

type VerificationInput = { provider: string; apiBaseUrl: string | null; defaultModel: string; apiKey: string };
type VerificationPayload = { userId: number; provider: string; apiBaseUrl: string | null; defaultModel: string; keyHash: string; expiresAt: number };

function signingKey() {
  if (!ENV.cookieSecret) throw new Error("A aplicação não está configurada para validar credenciais de IA.");
  return ENV.cookieSecret;
}

function encode(payload: VerificationPayload) {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

function sign(encoded: string) {
  return crypto.createHmac("sha256", signingKey()).update(encoded).digest("base64url");
}

function keyHash(apiKey: string) {
  return crypto.createHash("sha256").update(apiKey).digest("hex");
}

export function issueConnectionVerification(userId: number, input: VerificationInput) {
  const encoded = encode({ userId, provider: input.provider, apiBaseUrl: input.apiBaseUrl, defaultModel: input.defaultModel, keyHash: keyHash(input.apiKey), expiresAt: Date.now() + 5 * 60_000 });
  return `${encoded}.${sign(encoded)}`;
}

export function verifyConnectionVerification(userId: number, input: VerificationInput, token?: string) {
  if (!token) return false;
  const [encoded, receivedSignature, ...rest] = token.split(".");
  if (!encoded || !receivedSignature || rest.length) return false;
  const expectedSignature = sign(encoded);
  if (receivedSignature.length !== expectedSignature.length || !crypto.timingSafeEqual(Buffer.from(receivedSignature), Buffer.from(expectedSignature))) return false;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as VerificationPayload;
    return payload.userId === userId && payload.expiresAt >= Date.now() && payload.provider === input.provider && payload.apiBaseUrl === input.apiBaseUrl && payload.defaultModel === input.defaultModel && payload.keyHash === keyHash(input.apiKey);
  } catch {
    return false;
  }
}

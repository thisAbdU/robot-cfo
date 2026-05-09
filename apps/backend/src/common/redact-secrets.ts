/** Patterns that commonly appear in logs when secrets leak (keys, bearer tokens). */
const REDACT_PATTERNS: RegExp[] = [
  /\bsk-[a-zA-Z0-9]{16,}\b/g,
  /\bBearer\s+[A-Za-z0-9\-._~+/]+=*\b/gi,
];

/**
 * Best-effort redaction for structured logs. Never log raw env; use this on interpolated strings.
 */
export function redactSecrets(message: string): string {
  let out = message;
  for (const re of REDACT_PATTERNS) {
    out = out.replace(re, '[REDACTED]');
  }
  return out;
}

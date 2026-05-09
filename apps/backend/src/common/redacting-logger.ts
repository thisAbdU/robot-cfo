import { Logger } from '@nestjs/common';
import { redactSecrets } from './redact-secrets';

function wrapArgs(args: unknown[]): unknown[] {
  return args.map((a) =>
    typeof a === 'string' ? redactSecrets(a) : a,
  );
}

/**
 * Patches NestJS Logger methods so accidental secret strings in messages are redacted.
 */
export function patchLoggerRedaction(): void {
  const proto = Logger.prototype as unknown as Record<
    string,
    (...args: unknown[]) => void
  >;
  const methods = ['log', 'warn', 'error', 'debug', 'verbose'] as const;
  for (const m of methods) {
    const original = proto[m];
    if (typeof original !== 'function') {
      continue;
    }
    proto[m] = function (
      this: Logger,
      message: unknown,
      ...optionalParams: unknown[]
    ) {
      const msg =
        typeof message === 'string' ? redactSecrets(message) : message;
      return original.call(this, msg, ...wrapArgs(optionalParams));
    };
  }
}

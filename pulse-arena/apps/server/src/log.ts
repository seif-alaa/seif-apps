/** Minimal structured logger: one JSON object per line, easy to ship to any log service. */
export interface Logger {
  info(event: string, fields?: Record<string, unknown>): void;
  warn(event: string, fields?: Record<string, unknown>): void;
  error(event: string, fields?: Record<string, unknown>): void;
}

export function createLogger(enabled = true): Logger {
  const write = (level: string, event: string, fields?: Record<string, unknown>) => {
    if (!enabled) return;
    const line = JSON.stringify({ t: new Date().toISOString(), level, event, ...fields });
    if (level === 'error') console.error(line);
    else console.log(line);
  };
  return {
    info: (e, f) => write('info', e, f),
    warn: (e, f) => write('warn', e, f),
    error: (e, f) => write('error', e, f),
  };
}

import { formatDiagnostic } from "./diagnostics.js";

export interface Logger {
  log(
    level: "debug" | "info" | "warn" | "error",
    event: string,
    data?: Record<string, unknown>,
  ): void;
  error(event: string, error: unknown, data?: Record<string, unknown>): void;
}

// Native payloads and error messages may contain credentials or prompts. Never log them.
// Callers pass only safe scalar metadata (event types, session IDs) via `data`.
export const logger: Logger = {
  log(level, event, data) {
    if (level !== "debug")
      console.error(`[zcode:${level}] ${event}${suffix(data)}`);
  },
  error(event, error, data) {
    console.error(
      `[zcode:error] ${event}${suffix(data)}\n${formatDiagnostic(error)}`,
    );
  },
};

function suffix(data?: Record<string, unknown>): string {
  if (!data || Object.keys(data).length === 0) return "";
  const safe = Object.entries(data)
    .filter(
      ([, value]) =>
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean",
    )
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(" ");
  return safe ? ` (${safe})` : "";
}

export type ZCodeErrorCode =
  | "PERSISTENCE_INVALID"
  | "PERSISTENCE_WRITE_FAILED"
  | "PERSISTENCE_VERSION_UNSUPPORTED"
  | "INVALID_CONFIGURATION"
  | "INVALID_WORKSPACE"
  | "UNSUPPORTED_PLATFORM"
  | "UNSUPPORTED_ZCODE"
  | "RUNTIME_DISCOVERY_FAILED"
  | "RUNTIME_SMOKE_FAILED"
  | "NATIVE_PROTOCOL_ERROR"
  | "NATIVE_INPUT_REJECTED"
  | "NATIVE_TIMEOUT"
  | "NATIVE_EXITED"
  | "AUTH_REQUIRED"
  | "UNSUPPORTED_CONTENT"
  | "SESSION_NOT_FOUND"
  | "SESSION_BUSY"
  | "INTERACTION_UNSUPPORTED";

export class AdapterError extends Error {
  override readonly name = "ZCodeProviderError";

  constructor(
    readonly code: ZCodeErrorCode,
    message: string,
    readonly details: Record<string, unknown> = {},
    options?: ErrorOptions,
    readonly diagnostic?: RuntimeDiagnostic,
  ) {
    super(message, options);
  }
}

// Prompt failures where the native host may already own the input. The failed
// send's clientMessageId must stay reserved so the caller cannot re-execute it;
// every other failure never reached the host and may be retried under the same
// ID (Paseo's steer-unavailable replace fallback resends exactly that way).
const uncertainDeliveries = new WeakSet<object>();

export function markDeliveryUncertain(error: unknown): void {
  if (error instanceof Error) uncertainDeliveries.add(error);
}

export function isDeliveryUncertain(error: unknown): boolean {
  return error instanceof Error && uncertainDeliveries.has(error);
}

import type { RuntimeDiagnostic } from "./diagnostics.js";

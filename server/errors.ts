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
  | "RUNTIME_SETUP_REQUIRED"
  | "RUNTIME_SETUP_FAILED"
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

// ZCode may already own an input whose send failed after leaving the plugin.
// Its clientMessageId stays reserved so the same message never runs twice.
const uncertainDeliveries = new WeakSet<object>();
export function markDeliveryUncertain(error: unknown): void {
  if (error instanceof Error) uncertainDeliveries.add(error);
}
export function isDeliveryUncertain(error: unknown): boolean {
  return error instanceof Error && uncertainDeliveries.has(error);
}
import type { RuntimeDiagnostic } from "./diagnostics.js";

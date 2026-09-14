import { accessSync, constants } from "node:fs";
import { dirname, join } from "node:path";

import { AdapterError } from "../errors.js";

/** Official env override used by ZCode desktop (`yv()`). */
export const BUILTIN_PROVIDER_CONFIG_ENV = "ZCODE_BUILTIN_PROVIDER_CONFIG_FILE";

/** Plugin-scoped env used when spawning the headless host bridge. */
export const PASEO_BUILTIN_PROVIDER_CONFIG_ENV =
  "PASEO_ZCODE_BUILTIN_PROVIDER_CONFIG_FILE";

/**
 * Resolve ZCode 3.12+'s required init-local field
 * `zcodeBuiltinProviderConfigFilePath`.
 *
 * Packaged installs keep the file next to `app.asar`:
 * `Resources/config/provider/zcode-builtin.json`.
 */
export function resolveBuiltinProviderConfigPath(
  hostArchive: string,
  environment: NodeJS.ProcessEnv = process.env,
): string {
  const override =
    environment[PASEO_BUILTIN_PROVIDER_CONFIG_ENV]?.trim() ||
    environment[BUILTIN_PROVIDER_CONFIG_ENV]?.trim();
  if (override) return override;
  return join(dirname(hostArchive), "config/provider/zcode-builtin.json");
}

export function requireBuiltinProviderConfigPath(
  hostArchive: string,
  environment: NodeJS.ProcessEnv = process.env,
): string {
  const path = resolveBuiltinProviderConfigPath(hostArchive, environment);
  try {
    accessSync(path, constants.R_OK);
  } catch {
    throw new AdapterError(
      "RUNTIME_DISCOVERY_FAILED",
      `ZCode builtin provider config is missing or unreadable: ${path}`,
    );
  }
  return path;
}

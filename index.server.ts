import type { PluginServerContext } from "@getpaseo/plugin/server";
import { createZCodeProvider } from "./server/provider.js";
import { createDiagnosticsHandler } from "./server/status.js";
import { zcodeDiagnostics } from "./shared/diagnostics.js";
import { zcodeSettings } from "./shared/settings.js";

export default function contribute(server: PluginServerContext): () => void {
  const settings = server.registerSettings(zcodeSettings);
  const getCustomInstallPath = async () => {
    try {
      const state = await settings.read();
      return state.status === "ready" &&
        typeof state.values.customInstallPath === "string" &&
        state.values.customInstallPath.trim().length > 0
        ? state.values.customInstallPath.trim()
        : undefined;
    } catch {
      return undefined;
    }
  };

  server.registerProvider(
    createZCodeProvider(undefined, undefined, getCustomInstallPath),
  );
  server.handle(
    zcodeDiagnostics,
    createDiagnosticsHandler({ getCustomInstallPath }),
  );
  return () => {};
}

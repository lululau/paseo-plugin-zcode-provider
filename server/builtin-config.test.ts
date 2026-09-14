import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import {
  BUILTIN_PROVIDER_CONFIG_ENV,
  PASEO_BUILTIN_PROVIDER_CONFIG_ENV,
  requireBuiltinProviderConfigPath,
  resolveBuiltinProviderConfigPath,
} from "./host/builtin-config.js";

const cleanup: Array<() => Promise<unknown>> = [];
afterEach(async () => {
  for (const dispose of cleanup.splice(0).reverse()) await dispose();
});

describe("builtin provider config path", () => {
  test("defaults next to app.asar", () => {
    expect(
      resolveBuiltinProviderConfigPath(
        "/Applications/ZCode.app/Contents/Resources/app.asar",
        {},
      ),
    ).toBe(
      "/Applications/ZCode.app/Contents/Resources/config/provider/zcode-builtin.json",
    );
  });

  test("prefers plugin env then official env", () => {
    expect(
      resolveBuiltinProviderConfigPath("/ignored/app.asar", {
        [PASEO_BUILTIN_PROVIDER_CONFIG_ENV]: " /tmp/paseo.json ",
        [BUILTIN_PROVIDER_CONFIG_ENV]: "/tmp/official.json",
      }),
    ).toBe("/tmp/paseo.json");
    expect(
      resolveBuiltinProviderConfigPath("/ignored/app.asar", {
        [BUILTIN_PROVIDER_CONFIG_ENV]: " /tmp/official.json ",
      }),
    ).toBe("/tmp/official.json");
  });

  test("require checks the file is readable", async () => {
    const root = await mkdtemp(join(tmpdir(), "zcode-builtin-"));
    cleanup.push(() => rm(root, { recursive: true, force: true }));
    const hostArchive = join(root, "app.asar");
    const config = join(root, "config/provider/zcode-builtin.json");
    await mkdir(join(root, "config/provider"), { recursive: true });
    await writeFile(hostArchive, "asar");
    await writeFile(config, "{}");
    expect(requireBuiltinProviderConfigPath(hostArchive, {})).toBe(config);
    const other = await mkdtemp(join(tmpdir(), "zcode-builtin-missing-"));
    cleanup.push(() => rm(other, { recursive: true, force: true }));
    expect(() =>
      requireBuiltinProviderConfigPath(join(other, "app.asar"), {}),
    ).toThrow(/builtin provider config is missing/u);
  });
});

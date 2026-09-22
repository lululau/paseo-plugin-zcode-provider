import { defineSettings } from "@getpaseo/plugin";
import { z } from "zod";

export const zcodeSettings = defineSettings({
  id: "zcode-settings",
  scope: "host",
  version: 1,
  schema: z.object({
    customInstallPath: z
      .string()
      .trim()
      .default("")
      .describe("Custom ZCode install root or executable path"),
  }),
});

export type ZCodeSettings = z.infer<typeof zcodeSettings.schema>;

import { z } from "zod";
import { HANGAR_PLATFORMS } from "../types.js";

const platformEnum = z.enum(HANGAR_PLATFORMS);

const fileInputSchema = z
  .object({
    path: z.string().optional(),
    url: z.boolean().optional(),
    externalUrl: z.string().optional(),
    platforms: z
      .array(platformEnum)
      .nonempty("Platforms array cannot be empty"),
  })
  .refine(
    (file) => file.path || (file.url && file.externalUrl),
    "Must have either 'path' or both 'url' and 'externalUrl'",
  );

const pluginDependencySchema = z.object({
  name: z.string().min(1),
  required: z.boolean(),
  externalUrl: z.string().optional(),
});

export const actionInputsSchema = z.object({
  apiToken: z.string().min(1, "API token is required"),
  slug: z.string().min(1, "Project slug is required"),
  version: z.string().min(1, "Version is required"),
  channel: z.string().min(1, "Channel is required"),
  description: z.string().default(""),
  files: z.array(fileInputSchema).nonempty("At least one file is required"),
  platformDependencies: z
    .record(
      z.string().nonempty("Platform name cannot be empty"),
      z.array(z.string().nonempty("Platform version cannot be empty")),
    )
    .default({}),
  pluginDependencies: z
    .record(z.string(), z.array(pluginDependencySchema))
    .default({}),
});

export type ValidatedInputs = z.infer<typeof actionInputsSchema>;

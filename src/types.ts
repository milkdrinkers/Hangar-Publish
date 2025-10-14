import { ValidatedInputs } from "./input/inputValidation.js";

export const HANGAR_PLATFORMS = ["PAPER", "VELOCITY", "WATERFALL"] as const;
export type HangarPlatform = (typeof HANGAR_PLATFORMS)[number];

export interface FileInput {
  path?: string;
  url?: boolean;
  externalUrl?: string;
  platforms: HangarPlatform[];
}

export interface HangarFile {
  platforms: HangarPlatform[];
  url?: boolean;
  externalUrl?: string;
}

export interface PluginDependency {
  name: string;
  required: boolean;
  externalUrl?: string;
}

export interface VersionUpload {
  version: string;
  channel: string;
  description?: string;
  files: HangarFile[];
  pluginDependencies: Record<string, PluginDependency[]>;
  platformDependencies: Record<string, string[]>;
}

export interface RestAuthenticateResponse {
  expiresIn: number;
  token: string;
}

export interface RestUploadResponse {
  url: string;
}

export type ActionInputs = ValidatedInputs;

export class HangarError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly responseBody?: string,
  ) {
    super(message);
    this.name = "HangarError";
  }
}

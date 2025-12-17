import * as semver from "semver";
import { logger } from "../index.js";
import { normalizeVersionForSemver } from "../util/semverUtils.js";

export interface HangarProjectResponse {
  version: string;
  subVersions: string[];
}

export interface HangarPlatformVersion {
  semver: string;
  hangar: string;
}

const cachedPlatformVersions: Map<string, HangarPlatformVersion[]> = new Map();

/**
 * Get a list of versions from the Hangar API for the specified platform.
 * @param platform the Hangar platform name (e.g., "paper", "waterfall", "velocity")
 * @returns a list of version strings
 */
export const getPlatformVersions = async (platform: string) => {
  const cacheKey = platform.toLowerCase();

  if (cachedPlatformVersions.has(cacheKey))
    return cachedPlatformVersions.get(cacheKey)!;

  try {
    logger.debug(`Fetching ${platform} versions from Hangar API`);

    const response = await fetch(
      `https://hangar.papermc.io/api/v1/platforms/${platform.toLowerCase()}/versions`,
    );

    if (!response.ok) {
      throw new Error(
        `Failed to fetch ${platform} versions: ${response.statusText}`,
      );
    }

    const projectData = (await response.json()) as HangarProjectResponse[];

    // Filter out pre-release versions and only keep versions that can be normalized to semver
    const releaseVersions = Object.entries(projectData)
      .flatMap(([_, resp]) => {
        switch (platform.toLowerCase()) {
          case "velocity":
            return [resp.version, ...resp.subVersions]; // For velocity we include all versions
          default:
            return resp.subVersions;
        }
      })
      .filter(
        (v) =>
          !v.includes("pre") && !v.includes("rc") && !v.includes("snapshot"),
      )
      .map((v) => {
        return {
          semver: normalizeVersionForSemver(v),
          hangar: v,
        } as HangarPlatformVersion;
      })
      .filter((v) => v.semver !== null) // Remove if semver normalization failed
      .sort((a, b) => {
        // Sort using semver version
        const normalizedA = normalizeVersionForSemver(a.semver)!;
        const normalizedB = normalizeVersionForSemver(b.semver)!;
        return semver.rcompare(normalizedA, normalizedB);
      });

    cachedPlatformVersions.set(cacheKey, releaseVersions);
    logger.debug(`Cached ${releaseVersions.length} ${platform} versions`);

    return releaseVersions;
  } catch (error) {
    logger.error(`Failed to fetch ${platform} versions`, error);
    throw new Error(
      `Could not fetch ${platform} versions: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};

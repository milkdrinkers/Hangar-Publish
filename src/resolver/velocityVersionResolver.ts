import * as semver from "semver";
import { logger } from "../index.js";
import { normalizeVersionForSemver } from "../util/semverUtils.js";

interface HangarProjectResponse {
  version: string;
  subVersions: string[];
}

interface HangarPlatformVersion {
  semver: string;
  hangar: string;
}

const cachedVelocityMCVersions: Map<string, HangarPlatformVersion[]> =
  new Map();

/**
 * Get a list of versions from the Hangar API for the specified platform.
 * @param platform the Hangar platform name (e.g., "paper", "waterfall", "velocity")
 * @returns a list of version strings
 */
export const getVelocityVersions = async (platform: string) => {
  const cacheKey = platform.toLowerCase();

  if (cachedVelocityMCVersions.has(cacheKey))
    return cachedVelocityMCVersions.get(cacheKey)!;

  try {
    logger.debug(`Fetching ${platform} versions from Hangar API`);

    const response = await fetch(
      `https://hangar.papermc.io/api/v1/platforms/${platform}/versions`,
    );

    if (!response.ok) {
      throw new Error(
        `Failed to fetch ${platform} versions: ${response.statusText}`,
      );
    }

    const projectData = (await response.json()) as HangarProjectResponse[];

    // Filter out pre-release versions and only keep versions that can be normalized to semver
    const releaseVersions = Object.entries(projectData)
      .flatMap(([d, resp]) => {
        const versions = [resp.version, ...resp.subVersions];

        return versions;
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
      .filter((v) => v.semver !== null) // Keep original but filter by normalizability
      .sort((a, b) => {
        // Sort using normalized versions for comparison, but keep originals
        const normalizedA = normalizeVersionForSemver(a.semver)!;
        const normalizedB = normalizeVersionForSemver(b.semver)!;
        return semver.rcompare(normalizedA, normalizedB);
      });

    cachedVelocityMCVersions.set(cacheKey, releaseVersions);
    logger.debug(`Cached ${releaseVersions.length} ${platform} versions`);

    return releaseVersions;
  } catch (error) {
    logger.error(`Failed to fetch ${platform} versions`, error);
    throw new Error(
      `Could not fetch ${platform} versions: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};

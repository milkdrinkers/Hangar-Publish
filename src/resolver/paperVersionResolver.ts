import * as semver from "semver";
import { logger } from "../index.js";
import { normalizeVersionForSemver } from "../util/semverUtils.js";

interface PaperMCProjectResponse {
  project: {
    id: "string";
    name: "string";
  };
  versions: {
    [majorVersion: string]: string[];
  };
}

const cachedPaperMCVersions: Map<string, string[]> = new Map();

/**
 * Get a list of versions from the PaperMC API for the specified project.
 * @param project the PaperMC project name (e.g., "paper", "waterfall", "velocity")
 * @returns a list of version strings
 */
export const getPaperMCVersions = async (project: string) => {
  const cacheKey = project.toLowerCase();

  if (cachedPaperMCVersions.has(cacheKey))
    return cachedPaperMCVersions.get(cacheKey)!;

  try {
    logger.debug(`Fetching ${project} versions from PaperMC API`);

    const response = await fetch(
      `https://fill.papermc.io/v3/projects/${project}`,
    );

    if (!response.ok) {
      throw new Error(
        `Failed to fetch ${project} versions: ${response.statusText}`,
      );
    }

    const projectData = (await response.json()) as PaperMCProjectResponse;

    // Filter out pre-release versions and only keep versions that can be normalized to semver
    const releaseVersions = Object.entries(projectData.versions)
      .flatMap(([majorVersion, versions]) => {
        if (project !== "velocity") {
          return versions;
        } else {
          return [...versions, majorVersion]; // On Velocity include major-versions as targets
        }
      })
      .filter(
        (v) =>
          !v.includes("pre") && !v.includes("rc") && !v.includes("snapshot"),
      )
      .filter((v) => normalizeVersionForSemver(v) !== null) // Keep original but filter by normalizability
      .sort((a, b) => {
        // Sort using normalized versions for comparison, but keep originals
        const normalizedA = normalizeVersionForSemver(a)!;
        const normalizedB = normalizeVersionForSemver(b)!;
        return semver.rcompare(normalizedA, normalizedB);
      });

    cachedPaperMCVersions.set(cacheKey, releaseVersions);
    logger.debug(`Cached ${releaseVersions.length} ${project} versions`);

    return releaseVersions;
  } catch (error) {
    logger.error(`Failed to fetch ${project} versions`, error);
    throw new Error(
      `Could not fetch ${project} versions: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};

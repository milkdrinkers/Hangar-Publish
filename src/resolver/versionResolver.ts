import * as semver from "semver";
import { Logger } from "../logger.js";
import {
  normalizeVersionForSemver,
  normalizeVersionPattern,
} from "../util/semverUtils.js";
import {
  getPlatformVersions,
  HangarPlatformVersion,
} from "./hangarVersionResolver.js";

export class VersionResolver {
  private readonly logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Maps input platform dependency version patterns to valid HangarAPI platform versions.
   * @param platformDependencies a map of platform names to version patterns
   * @returns a map of platform names to resolved version strings
   */
  async resolvePlatformDependencies(
    platformDependencies: Record<string, string[]>,
  ): Promise<Record<string, string[]>> {
    const resolved: Record<string, string[]> = {};

    for (const [platform, versionPatterns] of Object.entries(
      platformDependencies,
    )) {
      this.logger.debug(
        `Resolving platform dependencies for ${platform}`,
        versionPatterns,
      );

      const platformLower = platform.toLowerCase();

      switch (platformLower) {
        case "paper":
          let paperVersions = await getPlatformVersions(platformLower);
          resolved[platform] = this.resolve(versionPatterns, paperVersions);
          break;
        case "velocity":
          let velocityVersions = await getPlatformVersions(platformLower);
          resolved[platform] = this.resolve(versionPatterns, velocityVersions);
          break;
        case "waterfall":
          let waterfallVersions = await getPlatformVersions(platformLower);
          resolved[platform] = this.resolve(versionPatterns, waterfallVersions);
          break;
        default:
          throw new Error("Invalid platform dependency name");
      }
    }

    return resolved;
  }

  /**
   * Wrapper for resolveVersions taking HangarPlatformVersion[] as input.
   * @param versionPatterns version patterns to resolve
   * @param versions list of available version platform versions to resolve against
   * @returns resolved hangar versions
   */
  private resolve(
    versionPatterns: string[],
    versions: HangarPlatformVersion[],
  ) {
    // Find matching versions using semver
    const semverMatches = this.resolveVersions(
      versionPatterns,
      versions.map((v) => v.semver),
    );

    return semverMatches
      .map((semverVersion) => {
        // Map semver version into hangar version
        for (const ver of versions) {
          if (ver.semver === semverVersion) return ver.hangar;
        }
        return null;
      })
      .filter((v) => v !== null);
  }

  /**
   * Resolve version patterns against a list of available versions using semver.
   * @param versionPatterns version patterns to resolve
   * @param versions list of available version strings to resolve against
   * @returns resolved version strings
   */
  private resolveVersions(versionPatterns: string[], versions: string[]) {
    // Resolve versions from versions using patterns
    const resolvedVersions = new Set(
      versionPatterns.flatMap((pattern) =>
        this.resolveMatchingVersions(pattern, versions),
      ),
    );

    // Convert to array and sort by semver (newest first), using normalized versions for comparison
    const result = Array.from(resolvedVersions).sort((a, b) => {
      try {
        const normalizedA = normalizeVersionForSemver(a);
        const normalizedB = normalizeVersionForSemver(b);

        if (normalizedA && normalizedB)
          return semver.rcompare(normalizedA, normalizedB);

        // Fallback to string comparison if normalization fails
        return b.localeCompare(a);
      } catch (error) {
        // Fallback to string comparison if semver comparison fails
        this.logger.debug(
          `Semver comparison failed for ${a} vs ${b}, using string comparison`,
        );
        return b.localeCompare(a);
      }
    });

    this.logger.debug(
      `Resolved patterns [${versionPatterns.join(", ")}] to ${result.length} versions:`,
      result,
    );
    return result;
  }

  /**
   * Resolve a single version pattern against a list of available versions.
   * @param versionPattern version pattern to match
   * @param versions list of available versions
   * @returns list of matching version strings
   */
  private resolveMatchingVersions(versionPattern: string, versions: string[]) {
    // try to normalize the pattern for semver
    const normalizedPattern = normalizeVersionPattern(versionPattern);

    try {
      // Check if it's a valid semver range or version
      if (semver.validRange(normalizedPattern)) {
        const matches = versions.filter((version) => {
          try {
            // Normalize the version for semver comparison, but keep the original
            const normalizedVersion = normalizeVersionForSemver(version);
            if (!normalizedVersion) {
              return false;
            }
            return semver.satisfies(normalizedVersion, normalizedPattern);
          } catch (error) {
            // If semver.satisfies fails, the version might not be valid semver
            this.logger.debug(
              `Semver.satisfies failed for version ${version} with pattern ${normalizedPattern}`,
            );
            return false;
          }
        });

        if (matches.length > 0) {
          return matches; // Return original version strings, not normalized ones
        }
      }
    } catch (error) {
      this.logger.debug(
        `Pattern '${normalizedPattern}' is not a valid semver range`,
      );
    }

    // Fallback to exact string match
    const exactMatches = versions.filter((v) => v === versionPattern);
    if (exactMatches.length > 0) {
      return exactMatches;
    }

    this.logger.warning(
      `No matches found for version pattern: ${versionPattern}`,
    );
    return [];
  }
}

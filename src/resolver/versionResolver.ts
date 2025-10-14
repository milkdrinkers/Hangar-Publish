import * as semver from "semver";
import { Logger } from "../logger.js";
import { getMinecraftVersions } from "./minecraftVersionResolver.js";
import { getPaperMCVersions } from "./paperVersionResolver.js";
import {
  normalizeVersionForSemver,
  normalizeVersionPattern,
} from "../util/semverUtils.js";

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

      switch (platform) {
        case "PAPER":
          let versionsMinecraft = await getMinecraftVersions();
          resolved[platform] = this.resolveVersions(
            versionPatterns,
            versionsMinecraft,
          );
          break;
        case "VELOCITY":
          // Hangar doesn't accept the real velocity version as returned by the PaperMC API, instead it only accepts weird variations
          // FIXME Temporarily hardcode velocity versions until Hangard exposes API to get versions

          // Currently this code does:
          // - Matches version patterns against Fill's velocity versions
          // - Maps matched Fill velocity versions to Hangar velocity versions

          const velocityVersions = [
            { fill: "3.4.0", hangar: "3.4" },
            { fill: "3.3.0", hangar: "3.3" },
            { fill: "3.2.0", hangar: "3.2" },
            { fill: "3.1.1", hangar: "3.1.1" },
            { fill: "3.1.0", hangar: "3.1.0" },
            { fill: "3.0.0", hangar: "3.0" },
            { fill: "1.1.9", hangar: "1.1.9" },
            { fill: "1.1.0", hangar: "1.1" },
            { fill: "1.0.0", hangar: "1.0" },
          ];

          const results = this.resolveVersions(
            versionPatterns,
            velocityVersions.map((v) => v.fill),
          );

          resolved[platform] = results
            .map((v) => {
              // Map fill version into hangar version
              for (const ver of velocityVersions) {
                if (ver.fill === v) return ver.hangar;
              }
              return null;
            })
            .filter((v) => v !== null);
          break;
        case "WATERFALL":
          let versionsWaterfall = await getPaperMCVersions(
            platform.toLowerCase(),
          );
          resolved[platform] = this.resolveVersions(
            versionPatterns,
            versionsWaterfall,
          );
          break;
        default:
          throw new Error("Invalid platform dependency name");
      }
    }

    return resolved;
  }

  /**
   * Resolve version patterns against a list of available versions using semver.
   * @param versionPatterns version patterns to resolve
   * @param versions list of available version strings to resolve against
   * @returns resolved version strings
   */
  private resolveVersions(
    versionPatterns: string[],
    versions: string[],
  ): string[] {
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
  private resolveMatchingVersions(
    versionPattern: string,
    versions: string[],
  ): string[] {
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

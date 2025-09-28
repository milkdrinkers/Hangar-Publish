import fetch from "node-fetch";
import * as semver from "semver";
import { Logger } from "./logger.js";

interface MinecraftVersion {
  id: string;
  type: "release" | "snapshot" | "old_beta" | "old_alpha";
  url: string;
  time: string;
  releaseTime: string;
}

interface MinecraftVersionManifest {
  latest: {
    release: string;
    snapshot: string;
  };
  versions: MinecraftVersion[];
}

interface PaperMCProjectResponse {
  project: {
    id: "string";
    name: "string";
  };
  versions: {
    [majorVersion: string]: string[];
  };
}

export class VersionResolver {
  private readonly logger: Logger;
  private cachedVersions: string[] | null = null;
  private cachedPaperMCVersions: Map<string, string[]> = new Map();

  constructor(logger: Logger) {
    this.logger = logger;
  }

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
          resolved[platform] =
            await this.resolveMinecraftVersions(versionPatterns);
          break;
        case "VELOCITY":
        case "WATERFALL":
          resolved[platform] = await this.resolvePaperMCVersions(
            platform.toLowerCase(),
            versionPatterns,
          );
          break;
        default:
          resolved[platform] = this.resolveGenericVersions(versionPatterns); // For unknown platforms, try to resolve with semver if possible
          break;
      }
    }

    return resolved;
  }

  private async resolveMinecraftVersions(
    patterns: string[],
  ): Promise<string[]> {
    const allVersions = await this.getMinecraftVersions();
    return this.resolveVersionsWithSemver(patterns, allVersions);
  }

  private async resolvePaperMCVersions(
    project: string,
    patterns: string[],
  ): Promise<string[]> {
    const allVersions = await this.getPaperMCVersions(project);
    return this.resolveVersionsWithSemver(patterns, allVersions);
  }

  private resolveGenericVersions(patterns: string[]): string[] {
    // For platforms where we don't have an API to fetch versions from,
    // we can only validate the input patterns and return them if they're valid semver
    const resolvedVersions = new Set<string>();

    for (const pattern of patterns) {
      // Check if it's a valid semver version (exact version)
      if (semver.valid(pattern)) {
        resolvedVersions.add(pattern);
      } else if (semver.validRange(pattern)) {
        // It's a valid range but we can't resolve it without knowing available versions
        this.logger.warning(
          `Cannot resolve semver range '${pattern}' without available versions list. Using as-is.`,
        );
        resolvedVersions.add(pattern);
      } else {
        // Not valid semver, but might be platform-specific version format
        this.logger.warning(`Invalid semver pattern '${pattern}', using as-is`);
        resolvedVersions.add(pattern);
      }
    }

    return Array.from(resolvedVersions);
  }

  private resolveVersionsWithSemver(
    patterns: string[],
    availableVersions: string[],
  ): string[] {
    const resolvedVersions = new Set<string>();

    for (const pattern of patterns) {
      const matchingVersions = this.getMatchingVersions(
        pattern,
        availableVersions,
      );
      matchingVersions.forEach((v) => resolvedVersions.add(v));
    }

    // Convert to array and sort by semver (newest first), using normalized versions for comparison
    const result = Array.from(resolvedVersions).sort((a, b) => {
      try {
        const normalizedA = this.normalizeVersionForSemver(a);
        const normalizedB = this.normalizeVersionForSemver(b);

        if (normalizedA && normalizedB) {
          return semver.rcompare(normalizedA, normalizedB);
        }

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
      `Resolved patterns [${patterns.join(", ")}] to ${result.length} versions:`,
      result,
    );
    return result;
  }

  private getMatchingVersions(
    pattern: string,
    availableVersions: string[],
  ): string[] {
    // First, try to normalize the pattern for semver
    const normalizedPattern = this.normalizeVersionPattern(pattern);

    try {
      // Check if it's a valid semver range or version
      if (semver.validRange(normalizedPattern)) {
        const matches = availableVersions.filter((version) => {
          try {
            // Normalize the version for semver comparison, but keep the original
            const normalizedVersion = this.normalizeVersionForSemver(version);
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
    const exactMatches = availableVersions.filter((v) => v === pattern);
    if (exactMatches.length > 0) {
      return exactMatches;
    }

    this.logger.warning(`No matches found for version pattern: ${pattern}`);
    return [];
  }

  private normalizeVersionForSemver(version: string): string | null {
    // If it's already valid semver, return as-is
    if (semver.valid(version)) {
      return version;
    }

    // Try to coerce to valid semver (handles cases like "1.20" -> "1.20.0")
    const coerced = semver.coerce(version);
    if (coerced) {
      return coerced.version;
    }

    // If coercion fails, log and return null
    this.logger.debug(`Could not normalize version to semver: ${version}`);
    return null;
  }

  private normalizeVersionPattern(pattern: string): string {
    // Handle .x patterns by converting them to semver ranges
    if (pattern.endsWith(".x")) {
      const baseVersion = pattern.slice(0, -2);
      // Convert "1.19.x" to "1.19.*" which is a valid semver range
      return `${baseVersion}.*`;
    }

    // Handle other common patterns that might need normalization
    if (pattern.includes("latest")) {
      this.logger.warning(
        `'latest' pattern not supported in semver, treating as exact match`,
      );
      return pattern;
    }

    return pattern;
  }

  private async getPaperMCVersions(project: string): Promise<string[]> {
    const cacheKey = project.toLowerCase();

    if (this.cachedPaperMCVersions.has(cacheKey)) {
      return this.cachedPaperMCVersions.get(cacheKey)!;
    }

    try {
      this.logger.debug(`Fetching ${project} versions from PaperMC API`);

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
        .flatMap(([majorVersion, versions]) => versions)
        .filter(
          (v) =>
            !v.includes("pre") && !v.includes("rc") && !v.includes("snapshot"),
        )
        .filter((v) => this.normalizeVersionForSemver(v) !== null) // Keep original but filter by normalizability
        .sort((a, b) => {
          // Sort using normalized versions for comparison, but keep originals
          const normalizedA = this.normalizeVersionForSemver(a)!;
          const normalizedB = this.normalizeVersionForSemver(b)!;
          return semver.rcompare(normalizedA, normalizedB);
        });

      this.cachedPaperMCVersions.set(cacheKey, releaseVersions);
      this.logger.debug(`Cached ${releaseVersions.length} ${project} versions`);

      return releaseVersions;
    } catch (error) {
      this.logger.error(`Failed to fetch ${project} versions`, error);
      throw new Error(
        `Could not fetch ${project} versions: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async getMinecraftVersions(): Promise<string[]> {
    if (this.cachedVersions) {
      return this.cachedVersions;
    }

    try {
      this.logger.debug("Fetching Minecraft version manifest from Mojang");

      const response = await fetch(
        "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json",
      );

      if (!response.ok) {
        throw new Error(
          `Failed to fetch version manifest: ${response.statusText}`,
        );
      }

      const manifest = (await response.json()) as MinecraftVersionManifest;

      // Filter to only release versions (excluding snapshots) and sort by release time
      const releaseVersions = manifest.versions
        .filter((v) => v.type === "release") // This excludes snapshots as requested
        .sort(
          (a, b) =>
            new Date(b.releaseTime).getTime() -
            new Date(a.releaseTime).getTime(),
        )
        .map((v) => v.id);

      this.cachedVersions = releaseVersions;
      this.logger.debug(
        `Cached ${releaseVersions.length} Minecraft versions (excluding snapshots)`,
      );

      return releaseVersions;
    } catch (error) {
      this.logger.error("Failed to fetch Minecraft versions", error);
      throw new Error(
        `Could not fetch Minecraft versions: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

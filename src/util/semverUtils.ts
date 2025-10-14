import * as semver from "semver";
import { logger } from "../index.js";

/**
 * Normalizes a version string to valid semver version.
 * @param version the version string to normalize
 * @returns normalized semver version string or null
 */
export const normalizeVersionForSemver = (version: string): string | null => {
  // If it's already valid semver, return as-is
  if (semver.valid(version)) return version;

  // Try to coerce to valid semver (handles cases like "1.20" -> "1.20.0")
  const coerced = semver.coerce(version);
  if (coerced) {
    return coerced.version;
  }

  // If coercion fails, log and return null
  logger.debug(`Could not normalize version to semver: ${version}`);
  return null;
};

/**
 * Normalizes a version pattern to a semver-compatible format. (We allow some custom shenanigans beyond the normal semver format)
 * @param pattern the version pattern to normalize
 * @returns normalized version pattern
 */
export const normalizeVersionPattern = (pattern: string) => {
  // Handle .x patterns by converting them to semver ranges
  if (pattern.endsWith(".x")) {
    return `${pattern.slice(0, -2)}.*`; // Convert "1.19.x" to "1.19.*" which is a valid semver range
  }

  // Handle other common patterns that might need normalization
  if (pattern.includes("latest")) {
    logger.warning(
      `'latest' pattern not supported in semver, treating as exact match`,
    );
    return pattern;
  }

  return pattern;
};

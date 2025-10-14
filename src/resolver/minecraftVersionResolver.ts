import fetch from "node-fetch";
import { logger } from "../index.js";

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

let cachedMinecraftVersions: string[] | null = null;

/**
 * Get a list of release Minecraft versions from the Mojang version manifest.
 * @returns a list of Minecraft version strings
 */
export const getMinecraftVersions = async () => {
  if (cachedMinecraftVersions) return cachedMinecraftVersions;

  try {
    logger.debug("Fetching Minecraft version manifest from Mojang");

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
      .filter((v) => v.type === "release")
      .sort(
        (a, b) =>
          new Date(b.releaseTime).getTime() - new Date(a.releaseTime).getTime(),
      )
      .map((v) => v.id);

    cachedMinecraftVersions = releaseVersions;
    logger.debug(
      `Cached ${releaseVersions.length} Minecraft versions (excluding snapshots)`,
    );

    return releaseVersions;
  } catch (error) {
    logger.error("Failed to fetch Minecraft versions", error);
    throw new Error(
      `Could not fetch Minecraft versions: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};

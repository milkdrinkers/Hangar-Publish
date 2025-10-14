import * as core from "@actions/core";
import { Logger } from "./logger.js";
import { parseInputs } from "./input/inputParser.js";
import { FileResolver } from "./resolver/fileResolver.js";
import { HangarClient } from "./client/hangarClient.js";
import { VersionResolver } from "./resolver/versionResolver.js";
import { VersionUpload, HangarError } from "./types.js";

const main = async (logger: Logger) => {
  logger.info("Starting Hangar Publish");

  const inputs = parseInputs();

  logger.info(
    `Uploading version ${inputs.version} to project ${inputs.slug} on channel ${inputs.channel}`,
  );

  const fileProcessor = new FileResolver(logger);
  const { form, filesData } = await fileProcessor.resolveFiles(inputs.files);

  const versionResolver = new VersionResolver(logger);
  const resolvedPlatformDependencies =
    await versionResolver.resolvePlatformDependencies(
      inputs.platformDependencies,
    );

  const versionUpload: VersionUpload = {
    version: inputs.version,
    channel: inputs.channel,
    description: inputs.description,
    files: filesData,
    pluginDependencies: inputs.pluginDependencies,
    platformDependencies: resolvedPlatformDependencies,
  };

  logger.debug("Version upload payload", versionUpload);

  const client = new HangarClient(logger);

  const token = await client.authenticate(inputs.apiToken, inputs.slug);

  const uploadResult = await client.uploadVersion(
    inputs.slug,
    token,
    form,
    versionUpload,
  );

  core.setOutput("upload_url", uploadResult.url);
  logger.info(`Upload completed successfully! URL: ${uploadResult.url}`);
};

export const logger = new Logger();

await main(logger).catch((error) => {
  if (error instanceof HangarError) {
    logger.error(`Hangar API error (${error.statusCode}): ${error.message}`);
    if (error.responseBody) {
      logger.debug("API response body", error.responseBody);
    }
  } else if (error instanceof Error) {
    logger.error(`Action failed: ${error.message}`);
    logger.debug("Error stack", error.stack);
  } else {
    logger.error("Unknown error occurred", error);
  }

  core.setFailed(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

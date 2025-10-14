import * as core from "@actions/core";
import { z } from "zod";
import { actionInputsSchema } from "./inputValidation.js";
import { ActionInputs } from "../types.js";
import { logger } from "../index.js";

export const parseInputs = (): ActionInputs => {
  try {
    logger.debug("Parsing action inputs");

    const apiToken = getRequiredInput("api_token");
    core.setSecret(apiToken);

    const slug = getRequiredInput("slug");
    const version = getRequiredInput("version");
    const channel = getRequiredInput("channel");
    const filesInput = getRequiredInput("files");

    const description = getOptionalInput("description");
    const platformDependenciesInput = getOptionalInput("platform_dependencies");
    const pluginDependenciesInput = getOptionalInput("plugin_dependencies");

    const files = parseJSONInput(filesInput, "files");
    const platformDependencies = parseJSONInput(
      platformDependenciesInput,
      "platform_dependencies",
    );
    const pluginDependencies = parseJSONInput(
      pluginDependenciesInput,
      "plugin_dependencies",
    );

    const parsedInputs = actionInputsSchema.parse({
      apiToken,
      slug,
      version,
      channel,
      description: description || "",
      files,
      platformDependencies: platformDependencies || {},
      pluginDependencies: pluginDependencies || {},
    });

    logger.debug("Successfully parsed and validated all inputs");

    return parsedInputs;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ");
      logger.error(`Input validation failed: ${errorMessages}`);
      throw new Error(`Invalid action inputs: ${errorMessages}`);
    }

    logger.error("Failed to parse inputs", error);
    throw error;
  }
};

const getRequiredInput = (name: string): string => {
  const value = core.getInput(name, { required: true });
  if (!value) throw new Error(`Required input '${name}' is missing or empty`);
  return value;
};

const getOptionalInput = (name: string): string | undefined => {
  return core.getInput(name) || undefined;
};

const parseJSONInput = (input: string | undefined, name: string): unknown => {
  if (!input) {
    return undefined;
  }

  try {
    return JSON.parse(input);
  } catch (error) {
    throw new Error(
      `Failed to parse ${name} as JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};

import fetch from "node-fetch";
import FormData from "form-data";
import {
  RestAuthenticateResponse,
  RestUploadResponse,
  VersionUpload,
  HangarError,
} from "../types.js";
import { Logger } from "../logger.js";
import * as core from "@actions/core";

export class HangarClient {
  private readonly baseUrl = "https://hangar.papermc.io/api/v1";
  private readonly logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Authenticates with the Hangar API using the provided API token returning a reusable JWT.
   * @param apiToken api token
   * @param slug project slug
   * @returns JWT for interacting with the hangar API
   */
  async authenticate(apiToken: string, slug: string): Promise<string> {
    this.logger.debug("Authenticating with Hangar API");

    try {
      const response = await fetch(
        `${this.baseUrl}/authenticate?apiKey=${encodeURIComponent(apiToken)}`,
        {
          method: "POST",
          headers: {
            "User-Agent": `hangar-publish; ${slug};`,
          },
        },
      );

      const responseText = await response.text();

      if (!response.ok) {
        throw new HangarError(
          `Authentication failed: ${response.statusText}`,
          response.status,
          responseText,
        );
      }

      let authResponse: RestAuthenticateResponse;
      try {
        authResponse = JSON.parse(responseText) as RestAuthenticateResponse;
      } catch (parseError) {
        throw new HangarError(
          "Invalid authentication response format",
          response.status,
          responseText,
        );
      }

      if (!authResponse.token) {
        throw new HangarError(
          "Authentication response missing token",
          response.status,
          responseText,
        );
      }

      core.setSecret(authResponse.token);

      this.logger.info("Successfully authenticated with Hangar API");
      this.logger.debug(`Token expires in: ${authResponse.expiresIn} seconds`);

      return authResponse.token;
    } catch (error) {
      if (error instanceof HangarError) {
        this.logger.error("Authentication failed", error);
        throw error;
      }

      const message = error instanceof Error ? error.message : String(error);
      this.logger.error("Network error during authentication", error);
      throw new HangarError(`Authentication network error: ${message}`);
    }
  }

  /**
   * Uploads a new version to the specified project.
   * @param slug project slug
   * @param token JWT token
   * @param form Form containing files to upload
   * @param versionUpload version metadata to uplaod
   * @returns upload response containing the URL of the uploaded version
   */
  async uploadVersion(
    slug: string,
    token: string,
    form: FormData,
    versionUpload: VersionUpload,
  ): Promise<RestUploadResponse> {
    this.logger.debug("Uploading version to Hangar", {
      version: versionUpload.version,
      channel: versionUpload.channel,
      filesCount: versionUpload.files.length,
    });

    form.append("versionUpload", JSON.stringify(versionUpload), {
      contentType: "application/json",
    });

    try {
      const response = await fetch(
        `${this.baseUrl}/projects/${encodeURIComponent(slug)}/upload`,
        {
          method: "POST",
          headers: {
            "User-Agent": `hangar-publish; ${slug};`,
            Authorization: token,
            ...form.getHeaders(),
          },
          body: form,
        },
      );

      const responseText = await response.text();

      if (!response.ok) {
        throw new HangarError(
          `Upload failed: ${response.statusText}`,
          response.status,
          responseText,
        );
      }

      let uploadResponse: RestUploadResponse;
      try {
        uploadResponse = JSON.parse(responseText) as RestUploadResponse;
      } catch (parseError) {
        throw new HangarError(
          "Invalid upload response format",
          response.status,
          responseText,
        );
      }

      if (!uploadResponse.url) {
        throw new HangarError(
          "Upload response missing URL",
          response.status,
          responseText,
        );
      }

      this.logger.info("Successfully uploaded version to Hangar");
      this.logger.debug("Upload response", uploadResponse);

      return uploadResponse;
    } catch (error) {
      if (error instanceof HangarError) {
        this.logger.error("Upload failed", error);
        throw error;
      }

      const message = error instanceof Error ? error.message : String(error);
      this.logger.error("Network error during upload", error);
      throw new HangarError(`Upload network error: ${message}`);
    }
  }
}

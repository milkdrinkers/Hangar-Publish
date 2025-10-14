import FormData from "form-data";
import fs from "fs/promises";
import path from "path";
import { glob } from "fast-glob";
import { FileInput, HangarFile } from "../types.js";
import { Logger } from "../logger.js";

export class FileResolver {
  private readonly logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Resolves the file inputs into the required FormData and HangarFile array.
   * @param fileInputs the file inputs
   * @returns the form data and file data array
   */
  async resolveFiles(
    fileInputs: FileInput[],
  ): Promise<{ form: FormData; filesData: HangarFile[] }> {
    const form = new FormData();
    const filesData: HangarFile[] = [];

    this.logger.info(`Resolving ${fileInputs.length} file input(s)`);

    for (let i = 0; i < fileInputs.length; i++) {
      const file = fileInputs[i];
      this.logger.debug(`Resolving file input ${i}`, file);

      try {
        if (file.path) {
          await this.resolveFilesFromPath(file, form, filesData);
        } else if (file.url && file.externalUrl) {
          this.addExternalFile(file, filesData);
        } else {
          throw new Error(
            `Invalid file configuration at index ${i}: ${JSON.stringify(file)}`,
          );
        }
      } catch (error) {
        this.logger.error(`Failed to resolve file at index ${i}`, error);
        throw new Error(
          `File resolver failed at index ${i}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    this.logger.info(`Successfully resolved ${filesData.length} file(s)`);
    return { form, filesData };
  }

  /**
   * Adds all files matching the given path/glob pattern to the FormData and the filesData array.
   * @param file the file input data
   * @param form the form data object
   * @param filesData the file data array
   */
  private async resolveFilesFromPath(
    file: FileInput,
    form: FormData,
    filesData: HangarFile[],
  ): Promise<void> {
    if (!file.path) throw new Error("File path is required");

    this.logger.debug(`Finding files matching pattern: ${file.path}`);
    const foundFiles = await glob(file.path, { absolute: true });

    if (foundFiles.length === 0)
      throw new Error(`No files found matching pattern: ${file.path}`);

    this.logger.info(
      `Found ${foundFiles.length} file(s) matching pattern: ${file.path}`,
    );

    for (const filePath of foundFiles) {
      await this.addFileToForm(filePath, file.platforms, form, filesData);
    }
  }

  /**
   * Adds a file to the FormData and updates the filesData array.
   * @param filePath the absolute path to the file
   * @param platforms the platforms this file supports
   * @param form the form data object
   * @param filesData the file data array
   */
  private async addFileToForm(
    filePath: string,
    platforms: FileInput["platforms"],
    form: FormData,
    filesData: HangarFile[],
  ): Promise<void> {
    try {
      await fs.access(filePath);

      const stats = await fs.stat(filePath);
      if (!stats.isFile()) throw new Error(`Path is not a file: ${filePath}`);

      this.logger.debug(
        `Adding file to form: ${filePath} (${stats.size} bytes)`,
      );

      const fileStream = (await import("fs")).createReadStream(filePath);
      const fileName = path.basename(filePath);

      form.append("files", fileStream, {
        contentType: "application/x-binary",
        filename: fileName,
      });

      filesData.push({ platforms });

      this.logger.debug(`Successfully added file: ${fileName}`);
    } catch (error) {
      throw new Error(
        `Failed to add file ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Adds an external file reference to the filesData array.
   * @param file the file input data
   * @param filesData the file data array
   */
  private addExternalFile(file: FileInput, filesData: HangarFile[]): void {
    if (!file.externalUrl)
      throw new Error("External URL is required for external files");

    this.logger.debug(`Adding external file: ${file.externalUrl}`);

    filesData.push({
      platforms: file.platforms,
      url: true,
      externalUrl: file.externalUrl,
    });

    this.logger.debug(`Successfully added external file: ${file.externalUrl}`);
  }
}

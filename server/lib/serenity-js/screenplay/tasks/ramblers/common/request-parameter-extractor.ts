import { PerformsActivities, Task } from "@serenity-js/core";
import { WalkRequestParameters } from "../../../../models/walk-request-parameters";
import { Log } from "./log";
import { Environment } from "../../../../../env-config/environment-model";
import { WalkUploadMetadata } from "../../../../../models/walk-upload-metadata";
import fs from "fs";

export class ExtractTask extends Task {
  performAs(actor: PerformsActivities): Promise<void> {
    const extractedParameters: WalkRequestParameters = RequestParameterExtractor.extract();
    return actor.attemptsTo(
      Log.message(`parameters supplied were ${JSON.stringify(extractedParameters)}`),
    );
  }
}

export class RequestParameterExtractor {
  static extract(): WalkRequestParameters {
    const metadataFilePath: string = process.env[Environment.RAMBLERS_METADATA_FILE];

    if (!metadataFilePath || !fs.existsSync(metadataFilePath)) {
      throw new Error(`Metadata file not found: ${metadataFilePath}`);
    }

    try {
      const metadataContent = fs.readFileSync(metadataFilePath, "utf8");
      const metadata: WalkUploadMetadata = JSON.parse(metadataContent);

      return {
        fileName: metadata.fileName,
        walkCount: metadata.walkCount,
        walkDeletions: metadata.walkDeletions,
        walkUploads: metadata.walkUploads || [],
        walkCancellations: metadata.walkCancellations,
        walkUncancellations: metadata.walkUncancellations,
      };
    } catch (error) {
      throw new Error(`Failed to read or parse metadata file: ${error.message}`);
    }
  }

  static extractTask = () => new ExtractTask(`Extract parameters from metadata file`);
}

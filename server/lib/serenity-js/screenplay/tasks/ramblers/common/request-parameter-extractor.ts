import { PerformsActivities, Task } from "@serenity-js/core";
import { WalkRequestParameters } from "../../../../models/walk-request-parameters";
import { Log } from "./log";
import { Environment } from "../../../../../env-config/environment-model";

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
    const walkDeletionsString: string = process.env[Environment.RAMBLERS_DELETE_WALKS] || "";
    const walkDeletions: string[] = walkDeletionsString.length > 1 ? walkDeletionsString.split(",").filter(walkId => walkId) : [];
    const fileName: string = process.env[Environment.RAMBLERS_FILENAME];
    const walkCount: number = +process.env[Environment.RAMBLERS_WALKCOUNT];
    return {
      walkDeletions,
      fileName,
      walkCount,
    };
  }

  static extractTask = () => new ExtractTask(`Extract parameters from environment variables`);
}

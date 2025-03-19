import { PerformsActivities, Task } from "@serenity-js/core";
import { WalkRequestParameters } from "../../../../models/walk-request-parameters";
import { Log } from "./log";

const ramblersDeleteWalks = "RAMBLERS_DELETE_WALKS";
const ramblersWalkCount = "RAMBLERS_WALKCOUNT";
const ramblersFileName = "RAMBLERS_FILENAME";

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
    const walkDeletionsString: string = process.env[ramblersDeleteWalks] || "";
    const walkDeletions: string[] = walkDeletionsString.length > 1 ? walkDeletionsString.split(",").filter(walkId => walkId) : [];
    const fileName: string = process.env[ramblersFileName];
    const walkCount: number = +process.env[ramblersWalkCount];
    return {
      walkDeletions,
      fileName,
      walkCount,
    };
  }

  static extractTask = () => new ExtractTask(`Extract parameters from environment variables`);
}

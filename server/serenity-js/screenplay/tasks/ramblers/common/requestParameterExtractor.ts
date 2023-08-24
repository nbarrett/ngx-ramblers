import { PerformsActivities, Task } from "@serenity-js/core";
import { Log } from "../../common/log";
import { WalkRequestParameters } from "../../../../models/walkRequestParameters";

const ramblersDeleteWalks = "RAMBLERS_DELETE_WALKS";
const ramblersWalkCount = "RAMBLERS_WALKCOUNT";
const ramblersFileName = "RAMBLERS_FILENAME";

export class ExtractTask implements Task {

  performAs(actor: PerformsActivities): Promise<void> {
    const extractedParameters: WalkRequestParameters = RequestParameterExtractor.extract();
    console.log("extractedParameters", extractedParameters);
    return actor.attemptsTo(
      Log.message(`parameters supplied were ${JSON.stringify(extractedParameters)}`),
    );
  }

}

export class RequestParameterExtractor {

  static extract(): WalkRequestParameters {
    const walkDeletionsString: string = process.env[ramblersDeleteWalks] || "";
    const walkDeletions: string[] = walkDeletionsString.length > 1 ? walkDeletionsString.split(",").map(walkId => walkId) : [];
    const fileName: string = process.env[ramblersFileName];
    const walkCount: number = +process.env[ramblersWalkCount];
    return {
      walkDeletions,
      fileName,
      walkCount,
    };
  }

  static extractTask = () => new ExtractTask();
}

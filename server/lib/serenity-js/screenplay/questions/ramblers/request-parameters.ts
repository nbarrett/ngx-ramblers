import { Question } from "@serenity-js/core";
import { RequestParameterExtractor } from "../../tasks/ramblers/common/request-parameter-extractor";

export class RequestParameters {

  static hasWalkUploads(): Question<Promise<boolean>> {
    return Question.about("request has walk uploads", async () => {
      const params = RequestParameterExtractor.extract();
      return (params.walkUploads?.length || 0) > 0;
    });
  }

  static hasWalkDeletionsOrCount(): Question<Promise<boolean>> {
    return Question.about("request has walk deletions or count", async () => {
      const params = RequestParameterExtractor.extract();
      return (params.walkCount || 0) > 0 || (params.walkDeletions?.length || 0) > 0;
    });
  }

  static hasWalkCount(): Question<Promise<boolean>> {
    return Question.about("request has walk count", async () => {
      const params = RequestParameterExtractor.extract();
      return (params.walkCount || 0) > 0;
    });
  }
}

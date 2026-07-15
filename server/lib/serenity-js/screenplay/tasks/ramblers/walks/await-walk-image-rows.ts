import { Duration, Task, Wait } from "@serenity-js/core";
import { Ensure, not, startsWith } from "@serenity-js/assertions";
import {
  WALK_IMAGE_ROWS_PENDING,
  WALK_IMAGE_ROWS_SETTLED,
  walkImageRowsStatus
} from "../../../questions/ramblers/walk-image-rows-status";

const TIMEOUT = Duration.ofMinutes(2);

export class AwaitWalkImageRows {

  static toNumber(expectedCount: number): Task {
    const status = walkImageRowsStatus(expectedCount);
    return Task.where(`#actor waits for ${expectedCount} walk image rows or a Walks Manager error`,
      Wait.upTo(TIMEOUT).until(status, not(startsWith(WALK_IMAGE_ROWS_PENDING))),
      Ensure.that(status, startsWith(WALK_IMAGE_ROWS_SETTLED)));
  }
}

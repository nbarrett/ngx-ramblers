import debug from "debug";
import { envConfig } from "../env-config/env-config";
import { extendedGroupEvent } from "../mongo/models/extended-group-event";
import { dateTimeNowAsValue } from "../shared/dates";
import { Status } from "../../../projects/ngx-ramblers/src/app/models/ramblers-upload-audit.model";
import { EventField, RamblersUploadOutcome } from "../../../projects/ngx-ramblers/src/app/models/walk.model";
import { ExtendedGroupEvent } from "../../../projects/ngx-ramblers/src/app/models/group-event.model";
import { publishedToRamblersEvent } from "../../../projects/ngx-ramblers/src/app/functions/walks/walk-event-snapshot";
import { RamblersUploadWalks } from "../models/ramblers-upload-execution.model";

const debugLog = debug(envConfig.logNamespace("ramblers-upload-outcome"));
debugLog.enabled = true;

const uploadsAwaitingOutcome = new Map<string, RamblersUploadWalks>();

export function rememberRamblersUploadWalks(jobId: string, walks: RamblersUploadWalks): void {
  if (walks.localWalkIds.length > 0) {
    uploadsAwaitingOutcome.set(jobId, walks);
  }
}

export async function recordRamblersUploadOutcome(jobId: string, status: Status): Promise<void> {
  const walks = uploadsAwaitingOutcome.get(jobId);
  uploadsAwaitingOutcome.delete(jobId);
  if (walks) {
    const at = dateTimeNowAsValue();
    const succeeded = status === Status.SUCCESS;
    const outcome: RamblersUploadOutcome = {fileName: walks.fileName, succeeded, at};
    const uploaded = await extendedGroupEvent.find({_id: {$in: walks.localWalkIds}}).lean<(ExtendedGroupEvent & {_id: unknown})[]>().exec();
    await Promise.all(uploaded.map(walk => extendedGroupEvent.updateOne({_id: walk._id}, {
      $set: {[EventField.RAMBLERS_UPLOAD]: outcome},
      ...(succeeded ? {$push: {events: publishedToRamblersEvent(walk, at, walks.memberId)}} : {})
    }).exec()));
    debugLog(`${walks.fileName}: recorded upload ${succeeded ? "success" : "failure"} on ${uploaded.length} walks`);
  }
}

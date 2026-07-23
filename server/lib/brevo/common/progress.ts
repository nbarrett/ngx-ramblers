import { isNumber } from "es-toolkit/compat";
import { MessageType, ProgressResponse } from "../../../../projects/ngx-ramblers/src/app/models/websocket.model";
import { broadcast } from "../../websockets/websocket-broadcaster";

export function reportBrevoProgress(message: string, completed?: number, total?: number): void {
  const percent = isNumber(completed) && isNumber(total) && total > 0
    ? Math.round((completed / total) * 100)
    : undefined;
  const progress: ProgressResponse = { message, percent, completed, total };
  broadcast(MessageType.MEMBER_SYNC_PROGRESS, progress);
}

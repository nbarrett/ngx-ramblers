import WebSocket from "ws";
import { RamblersWalksUploadRequest } from "../../../projects/ngx-ramblers/src/app/models/ramblers-walks-manager";
import { dispatchRamblersWalksUpload } from "./ramblers-upload-dispatcher";

export async function handleRamblersWalksUpload(ws: WebSocket, request: RamblersWalksUploadRequest): Promise<void> {
  await dispatchRamblersWalksUpload(ws, request);
}

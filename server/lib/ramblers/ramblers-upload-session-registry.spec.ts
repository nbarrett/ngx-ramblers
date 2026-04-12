import expect from "expect";
import { describe, it } from "mocha";
import WebSocket from "ws";
import {
  activateRamblersUploadSession,
  activeRamblersUploadJobId,
  completeRamblersUploadSession,
  currentRamblersUploadSession,
  registerRamblersUploadSession
} from "./ramblers-upload-session-registry";

describe("ramblersUploadSessionRegistry", () => {
  it("keeps the first active job until explicitly switched", () => {
    const firstSocket = { readyState: WebSocket.OPEN } as unknown as WebSocket;
    const secondSocket = { readyState: WebSocket.OPEN } as unknown as WebSocket;

    registerRamblersUploadSession("job-1", "first.csv", firstSocket);
    registerRamblersUploadSession("job-2", "second.csv", secondSocket);

    expect(activeRamblersUploadJobId()).toEqual("job-1");
    expect(currentRamblersUploadSession()?.fileName).toEqual("first.csv");

    activateRamblersUploadSession("job-2");

    expect(activeRamblersUploadJobId()).toEqual("job-2");
    expect(currentRamblersUploadSession()?.fileName).toEqual("second.csv");

    completeRamblersUploadSession("job-1");
    completeRamblersUploadSession("job-2");
  });
});

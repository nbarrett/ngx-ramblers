import expect from "expect";
import { describe, it, afterEach } from "mocha";
import sinon from "sinon";
import { Request, Response } from "express";
import { resizeStatus } from "./integration-worker-resize-status-controller";
import { clearResizeQueueState, setResizeQueueState } from "../aws/image-resize-session-registry";
import { ProgressResponse } from "../../../projects/ngx-ramblers/src/app/models/websocket.model";

const albumId = "fictional-album";

describe("album resize status", () => {
  afterEach(() => clearResizeQueueState(albumId));

  it("returns a normal empty response when no job is running", () => {
    const json = sinon.spy();
    resizeStatus({params: {contentMetadataId: albumId}} as unknown as Request, {json} as unknown as Response);
    expect(json.calledOnceWithExactly(null)).toEqual(true);
  });

  it("returns the active resize progress", () => {
    const state = {message: "Resizing photos", queued: true} as ProgressResponse;
    setResizeQueueState(albumId, state);
    const json = sinon.spy();
    resizeStatus({params: {contentMetadataId: albumId}} as unknown as Request, {json} as unknown as Response);
    expect(json.calledOnceWithExactly(state)).toEqual(true);
  });
});

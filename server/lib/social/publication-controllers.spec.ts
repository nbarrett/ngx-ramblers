import expect from "expect";
import sinon from "sinon";
import { afterEach, beforeEach, describe, it } from "mocha";
import { SocialNetwork } from "../../../projects/ngx-ramblers/src/app/models/social-publish.model";
import * as systemConfigModule from "../config/system-config";
import * as facebookPublish from "../facebook/facebook-publish";
import * as recentPosts from "../facebook/recent-posts";
import { socialPublication } from "../mongo/models/social-publication";
import { deletePublication } from "./publication-controllers";

function mockResponse() {
  const res: any = {statusCode: 200, body: undefined};
  res.status = sinon.stub().callsFake((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json = sinon.stub().callsFake((payload: any) => {
    res.body = payload;
    return res;
  });
  return res;
}

describe("deletePublication", () => {
  let sandbox: sinon.SinonSandbox;
  let deleteFacebookPost: sinon.SinonStub;
  let clearRecentPostsCache: sinon.SinonStub;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    sandbox.stub(systemConfigModule, "systemConfig").resolves({externalSystems: {facebook: {pageAccessToken: "token"}}} as any);
    deleteFacebookPost = sandbox.stub(facebookPublish, "deleteFacebookPost").resolves();
    sandbox.stub(socialPublication, "deleteMany").resolves({deletedCount: 1} as any);
    clearRecentPostsCache = sandbox.stub(recentPosts, "clearRecentPostsCache");
  });

  afterEach(() => {
    sandbox.restore();
  });

  it("clears the Facebook feed cache once the post has been deleted, so the panel stops showing it", async () => {
    const res = mockResponse();
    const request = {network: SocialNetwork.FACEBOOK, postId: "123_456", albumName: "walk-photos"};

    await deletePublication({body: request} as any, res);

    expect(res.statusCode).toEqual(200);
    expect(res.body).toEqual({request, response: {deleted: true}});
    expect(deleteFacebookPost.calledOnce).toEqual(true);
    expect(clearRecentPostsCache.calledOnce).toEqual(true);
  });

  it("leaves the feed cache alone when the post could not be deleted", async () => {
    deleteFacebookPost.rejects(new Error("Graph API unavailable"));
    const res = mockResponse();

    await deletePublication({body: {network: SocialNetwork.FACEBOOK, postId: "123_456", albumName: "walk-photos"}} as any, res);

    expect(res.statusCode).toEqual(502);
    expect(res.body.error).toEqual("Graph API unavailable");
    expect(clearRecentPostsCache.called).toEqual(false);
  });
});

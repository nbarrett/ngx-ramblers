import { afterEach, describe, it } from "mocha";
import expect from "expect";
import sinon from "sinon";
import { Request, Response } from "express";
import { create, update } from "./notification-config";
import { notificationConfig } from "../models/notification-config";
import { NotificationConfig, TemplateOverrideState, TemplateOverrideType } from "../../../../projects/ngx-ramblers/src/app/models/mail.model";

function configuration(): Partial<NotificationConfig> {
  return {
    body: `![App](api/aws/s3/site-content/app.png)`,
    templateOverrides: {
      HOME_PAGE_IMAGE: {type: TemplateOverrideType.IMAGE, state: TemplateOverrideState.CUSTOM, imageUrl: "https://group.example.org.uk/api/aws/s3/site-content/home.png"},
      INTRO: {type: TemplateOverrideType.CONTENT, state: TemplateOverrideState.CUSTOM, content: `<img src="/api/aws/s3/site-content/intro.png">`}
    }
  };
}

describe("notification configuration image persistence", () => {
  const sandbox = sinon.createSandbox();
  afterEach(() => sandbox.restore());

  it("stores object keys for pasted body images and overrides when creating a template", async () => {
    const write = sandbox.stub(notificationConfig, "create").resolves({_id: "aaaaaaaaaaaaaaaaaaaaaaaa"} as any);
    const response = {status: sandbox.stub().returnsThis(), json: sandbox.stub()};
    await create({body: configuration()} as Request, response as unknown as Response);
    expect(response.status.calledWith(201)).toBe(true);
    const saved = write.firstCall.args[0] as NotificationConfig;
    expect(saved.body).toBe("![App](site-content/app.png)");
    expect(saved.templateOverrides.HOME_PAGE_IMAGE.imageUrl).toBe("site-content/home.png");
    expect(saved.templateOverrides.INTRO.content).toBe(`<img src="site-content/intro.png">`);
  });

  it("normalises only the requested write when updating an existing template", async () => {
    const write = sandbox.stub(notificationConfig, "findOneAndUpdate").returns({exec: async () => ({_id: "aaaaaaaaaaaaaaaaaaaaaaaa"})} as any);
    const response = {status: sandbox.stub().returnsThis(), json: sandbox.stub()};
    await update({body: configuration(), params: {id: "aaaaaaaaaaaaaaaaaaaaaaaa"}} as unknown as Request, response as unknown as Response);
    expect(response.status.calledWith(200)).toBe(true);
    const saved = write.firstCall.args[1].$set;
    expect(saved.body).toBe("![App](site-content/app.png)");
    expect(saved["templateOverrides.HOME_PAGE_IMAGE.imageUrl"]).toBe("site-content/home.png");
    expect(saved["templateOverrides.INTRO.content"]).toBe(`<img src="site-content/intro.png">`);
  });
});

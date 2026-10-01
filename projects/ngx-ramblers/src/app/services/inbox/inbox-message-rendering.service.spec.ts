import {TestBed} from "@angular/core/testing";
import {beforeEach, describe, expect, it} from "vitest";
import {InboxMessageRenderingService} from "./inbox-message-rendering.service";
import {StringUtilsService} from "../string-utils.service";
import {UrlService} from "../url.service";
import {InboxMessage} from "../../models/inbox.model";

describe("inbox message rendering", () => {
  beforeEach(() => TestBed.configureTestingModule({providers: [
    InboxMessageRenderingService,
    {provide: StringUtilsService, useValue: {htmlToPlainText: (value: string) => value.replace(/<[^>]*>/g, " ")}},
    {provide: UrlService, useValue: {resourceRelativePathForAWSFileName: (key: string) => `/attachments/${key}`}}
  ]}));

  it("renders inline images while retaining downloadable attachments", () => {
    const service = TestBed.inject(InboxMessageRenderingService);
    const message = {messageId: "message-1", bodyHtml: '<p>Hello</p><img src="cid:PHOTO">', attachments: [
      {contentId: "photo", s3Key: "photo.png"},
      {s3Key: "document.pdf"},
      {contentId: "unused", s3Key: "unused.png"}
    ]} as InboxMessage;
    service.prepare([message]);
    expect(service.renderableBody(message)).toContain('src="/attachments/photo.png"');
    expect(service.visibleAttachments(message)).toEqual(message.attachments.slice(1));
    expect(service.messagePreview(message)).toBe("Hello");
    expect(message.bodyHtml).toContain("cid:PHOTO");
    expect(message.attachments).toHaveLength(3);
  });

  it("rebuilds cached content when a fetched message replaces the previous content", () => {
    const service = TestBed.inject(InboxMessageRenderingService);
    const first = {messageId: "message-1", bodyText: "First", attachments: []} as InboxMessage;
    service.prepare([first]);
    expect(service.renderableBody(first)).toBe("<pre>First</pre>");
    const updated = {...first, bodyText: "Updated"};
    service.prepare([updated]);
    expect(service.messagePreview(updated)).toBe("Updated");
    expect(service.renderableBody(updated)).toBe("<pre>Updated</pre>");
  });
});

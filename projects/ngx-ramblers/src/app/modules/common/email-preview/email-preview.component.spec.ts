import {TestBed} from "@angular/core/testing";
import {LoggerTestingModule} from "ngx-logger/testing";
import {describe, expect, it, vi} from "vitest";
import {EmailPreviewComponent} from "./email-preview.component";
import {MailService} from "../../../services/mail/mail.service";
import {TemplateRenderRequest, TemplateRenderResponse} from "../../../models/mail.model";

describe("rendered email previews", () => {
  it("keeps the newest preview when an older server render finishes later", async () => {
    const resolvers = {first: null as ((value: TemplateRenderResponse) => void) | null,
      second: null as ((value: TemplateRenderResponse) => void) | null};
    const first = new Promise<TemplateRenderResponse>(resolve => resolvers.first = resolve);
    const second = new Promise<TemplateRenderResponse>(resolve => resolvers.second = resolve);
    const mail = {renderTemplate: vi.fn().mockReturnValueOnce(first).mockReturnValueOnce(second)};
    TestBed.configureTestingModule({imports: [EmailPreviewComponent, LoggerTestingModule], providers: [{provide: MailService, useValue: mail}]});
    const fixture = TestBed.createComponent(EmailPreviewComponent);
    const component = fixture.componentInstance;
    vi.spyOn(component as any, "toPreviewUrl").mockImplementation(html => html);
    const older = component.render({htmlContent: "Older content"} as TemplateRenderRequest);
    const newer = component.render({htmlContent: "New content"} as TemplateRenderRequest);
    resolvers.second({htmlContent: "<html><body>New rendered content</body></html>"});
    await newer;
    resolvers.first({htmlContent: "<html><body>Old rendered content</body></html>"});
    await older;
    expect(component.previewHtml).toContain("New rendered content");
    expect(component.loading).toBe(false);
  });

  it("does not render an identical request again during change detection", async () => {
    const mail = {renderTemplate: vi.fn().mockResolvedValue({htmlContent: "Rendered email"})};
    TestBed.configureTestingModule({imports: [EmailPreviewComponent, LoggerTestingModule], providers: [{provide: MailService, useValue: mail}]});
    const fixture = TestBed.createComponent(EmailPreviewComponent);
    vi.spyOn(fixture.componentInstance as any, "toPreviewUrl").mockReturnValue(null);
    const request = {htmlContent: "Event preview"} as TemplateRenderRequest;
    fixture.componentRef.setInput("request", request);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.componentRef.setInput("request", {...request});
    fixture.detectChanges();
    await fixture.whenStable();
    expect(mail.renderTemplate).toHaveBeenCalledOnce();
  });
});

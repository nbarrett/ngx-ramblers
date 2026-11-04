import {TestBed} from "@angular/core/testing";
import {describe, expect, it, vi} from "vitest";
import {EventTemplateService} from "./event-template.service";
import {PageContentService} from "../page-content.service";
import {PageContentActionsService} from "../page-content-actions.service";
import {ContentTemplateType, PageContent, PageContentType} from "../../models/content-text.model";
import {PROGRAMME_EVENT_TEMPLATE_PATH_PREFIX} from "../../models/email-composer.model";

describe("reusable event templates", () => {
  function setup() {
    const pages = {all: vi.fn().mockResolvedValue([]), create: vi.fn().mockImplementation(async template => ({...template, id: "template-1"})),
      update: vi.fn().mockImplementation(async template => template)};
    TestBed.configureTestingModule({providers: [EventTemplateService,
      {provide: PageContentService, useValue: pages},
      {provide: PageContentActionsService, useValue: {defaultRowFor: () => ({type: PageContentType.TEXT, columns: [{}]})}}]});
    return {pages, service: TestBed.inject(EventTemplateService)};
  }

  it("offers populated supplied formats without creating records on read", async () => {
    const {service, pages} = setup();
    const formats = await service.available();
    expect(formats.map(format => format.migrationTemplate.templateName)).toEqual(["Programme listing (three columns)", "Detailed", "Compact"]);
    expect(formats.every(format => service.content(format).includes("{{title}}"))).toBe(true);
    expect(pages.create).not.toHaveBeenCalled();
    expect(pages.update).not.toHaveBeenCalled();
  });

  it("loads a saved supplied-format edit in place of its default", async () => {
    const {service, pages} = setup();
    const saved = {id: "saved-layout", path: PROGRAMME_EVENT_TEMPLATE_PATH_PREFIX + "detailed", rows: [{columns: [{contentText: "Updated {{title}}"}]}]} as PageContent;
    pages.all.mockResolvedValue([saved]);
    const formats = await service.available();
    expect(formats).toHaveLength(3);
    expect(formats[1]).toBe(saved);
    expect(service.content(formats[1])).toBe("Updated {{title}}");
  });

  it("saves a supplied default into its fixed path the first time it is edited", async () => {
    const {service, pages} = setup();
    const original = (await service.available())[1];
    const saved = await service.save(original.migrationTemplate.templateName, "Revised {{title}}", original);
    expect(saved.path).toBe(PROGRAMME_EVENT_TEMPLATE_PATH_PREFIX + "detailed");
    expect(pages.create).toHaveBeenCalledOnce();
    expect(pages.update).not.toHaveBeenCalled();
  });

  it("stores an event template with image fields in the existing content library", async () => {
    const {service, pages} = setup();
    const saved = await service.save("Walk with image", "## {{title}}\n\n{{image}}");
    expect(saved.path).toBe(PROGRAMME_EVENT_TEMPLATE_PATH_PREFIX + "walk-with-image");
    expect(saved.migrationTemplate.templateType).toBe(ContentTemplateType.USER_TEMPLATE);
    expect(service.content(saved)).toContain("{{image:240}}");
    expect(saved.rows[0].columns[0].imageHeight).toBe(240);
    expect(pages.update).not.toHaveBeenCalled();
  });

  it("stores the chosen image height on the template column", async () => {
    const {service, pages} = setup();
    const saved = await service.save("Walk with image", "## {{title}}\n\n{{image}}", null, 160);
    expect(service.imageHeight(saved)).toBe(160);
    expect(service.content(saved)).toContain("{{image:160}}");
    expect(pages.create).toHaveBeenCalledOnce();
  });

  it("updates the selected template instead of creating another copy", async () => {
    const {service, pages} = setup();
    const original = await service.save("Walk layout", "{{title}}");
    const saved = await service.save("Walk layout with image", "{{image}}\n\n{{title}}", original);
    expect(saved.id).toBe(original.id);
    expect(saved.path).toBe(original.path);
    expect(service.content(saved)).toContain("{{image:240}}");
    expect(pages.update).toHaveBeenCalledOnce();
    expect(pages.create).toHaveBeenCalledOnce();
  });

  it("rejects duplicate names and empty content without replacing another template", async () => {
    const {service, pages} = setup();
    pages.all.mockResolvedValue([{id: "existing"} as PageContent]);
    await expect(service.save("Existing", "{{title}}")).rejects.toThrow("already exists");
    await expect(service.save("New", "  ")).rejects.toThrow("event content");
    expect(pages.create).not.toHaveBeenCalled();
    expect(pages.update).not.toHaveBeenCalled();
  });
});

import {inject, Injectable} from "@angular/core";
import {kebabCase} from "es-toolkit/compat";
import {ContentTemplateType, PageContent, PageContentType} from "../../models/content-text.model";
import {EVENT_EMAIL_IMAGE_HEIGHT, ProgrammeEventFormat, PROGRAMME_EVENT_FORMATS, PROGRAMME_EVENT_TEMPLATES, PROGRAMME_EVENT_TEMPLATE_PATH_PREFIX} from "../../models/email-composer.model";
import {programmeImageHeightFromMarkdown, programmeImageMergeToken} from "../../functions/email-composer-programme";
import {rowsWithin} from "../../functions/map-location-markers";
import {PageContentService} from "../page-content.service";
import {PageContentActionsService} from "../page-content-actions.service";

@Injectable({providedIn: "root"})
export class EventTemplateService {
  private pages = inject(PageContentService);
  private actions = inject(PageContentActionsService);

  content(template: PageContent): string {
    return rowsWithin(template.rows).flatMap(row => (row.columns || []).map(column => column.contentText || "")).filter(Boolean).join("\n\n");
  }

  imageHeight(template: PageContent | null): number {
    const stored = rowsWithin(template?.rows).flatMap(row => (row.columns || []).map(column => column.imageHeight)).find(height => height > 0);
    return programmeImageHeightFromMarkdown(template ? this.content(template) : "", stored || EVENT_EMAIL_IMAGE_HEIGHT);
  }

  async available(): Promise<PageContent[]> {
    const saved = (await this.pages.all()).filter(template => template.path?.startsWith(PROGRAMME_EVENT_TEMPLATE_PATH_PREFIX));
    const supplied = PROGRAMME_EVENT_FORMATS.filter(format => format.value !== ProgrammeEventFormat.EMAIL && format.value !== ProgrammeEventFormat.CUSTOM)
      .map(format => {
        const path = PROGRAMME_EVENT_TEMPLATE_PATH_PREFIX + format.value;
        return saved.find(template => template.path === path) || this.page(format.label, PROGRAMME_EVENT_TEMPLATES[format.value], path);
      });
    return [...supplied, ...saved.filter(template => !supplied.some(preset => preset.path === template.path))];
  }

  private page(name: string, markdown: string, path: string, existing: PageContent | null = null, imageHeight = EVENT_EMAIL_IMAGE_HEIGHT): PageContent {
    const row = this.actions.defaultRowFor(PageContentType.TEXT);
    row.columns[0].contentText = markdown;
    row.columns[0].imageHeight = imageHeight;
    return {...existing, path, rows: [row], migrationTemplate: {
      ...existing?.migrationTemplate, templateType: ContentTemplateType.USER_TEMPLATE, templateName: name.trim(),
      templateDescription: "Reusable event listing format for email and printed programmes"
    }};
  }

  async save(name: string, markdown: string, existing: PageContent | null = null, imageHeight = EVENT_EMAIL_IMAGE_HEIGHT): Promise<PageContent> {
    const path = existing?.path || PROGRAMME_EVENT_TEMPLATE_PATH_PREFIX + kebabCase(name);
    const matches = existing?.id ? [] : await this.pages.all({criteria: {path}});
    if (!name.trim() || !markdown.trim()) {
      throw new Error("Enter a template name and event content before saving.");
    } else if (matches.length) {
      throw new Error("A template with that name already exists. Select it to edit, or choose a different name.");
    } else {
      const template = this.page(name, this.withImageHeight(markdown, imageHeight), path, existing, imageHeight);
      return existing?.id ? this.pages.update(template) : this.pages.create(template);
    }
  }

  private withImageHeight(markdown: string, imageHeight: number): string {
    if (!/\{\{\s*image(?::\d+)?\s*}}/.test(markdown)) {
      return markdown;
    } else {
      return markdown.replace(/\{\{\s*image(?::\d+)?\s*}}/g, `{{${programmeImageMergeToken(imageHeight)}}}`);
    }
  }
}

import { EmailComposerSessionService } from "../../services/email-composer/email-composer-session.service";
import { CommitteeFileEmailInclude, ComposerFragment, ComposerFragmentKind, SectionDividerStyle } from "../../models/email-composer.model";
import { EmailComposerFragmentsService } from "../../services/email-composer/email-composer-fragments.service";
import { inject } from "@angular/core";
import { isArray, kebabCase } from "es-toolkit/compat";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "../../services/logger-factory.service";
import { committeeFileEmailSendsContent, committeeMarkdownForEmail, hasCommitteeDocumentContent, resolvedCommitteeFileEmailInclude } from "../../functions/committee-file-email";
import { StringUtilsService } from "../../services/string-utils.service";
import { UrlService } from "../../services/url.service";
import { DateUtilsService } from "../../services/date-utils.service";
import { CommitteeFile, NotificationItem } from "../../models/committee.model";
import { CommitteeFileService } from "../../services/committee/committee-file.service";
import { CommitteeDisplayService } from "../../pages/committee/committee-display.service";
import { PageService } from "../../services/page.service";
import { PageContentService } from "../../services/page-content.service";
import { PageContent } from "../../models/content-text.model";
import { Injectable } from "@angular/core";


@Injectable()
export class EmailComposerDocumentsService {
  logger: Logger = inject(LoggerFactory).createLogger("EmailComposer", NgxLoggerLevel.ERROR);

  session = inject(EmailComposerSessionService);

  committeeFileService = inject(CommitteeFileService);

  pageContentService = inject(PageContentService);

  fragmentEditor = inject(EmailComposerFragmentsService);

  stringUtils = inject(StringUtilsService);

  dateUtils = inject(DateUtilsService);

  committeeDisplayService = inject(CommitteeDisplayService);

  urlService = inject(UrlService);

  pageService = inject(PageService);

  committeeFiles: Map<string, CommitteeFile> = new Map();

  allCommitteeFiles: CommitteeFile[] = [];

  committeeFileUrlInput = "";

  committeeFileUrlError: string | null = null;

  committeeFileUrlAllowedIds: string[] | null = null;

  async loadAllCommitteeFiles(): Promise<void> {
      try {
        this.allCommitteeFiles = await this.committeeFileService.all();
      } catch (error) {
        this.logger.error("loadAllCommitteeFiles failed", error);
        this.allCommitteeFiles = [];
      }
    }

  onPickerFilesLoaded(files: CommitteeFile[]): void {
      this.allCommitteeFiles = files ?? [];
      void this.resolveCommitteeFiles(this.allFragmentCommitteeFileIds());
    }

  async resolveCommitteeFiles(ids: string[]): Promise<void> {
      this.committeeFiles = new Map();
      if (!(!ids?.length || !this.allCommitteeFiles?.length)) {
        const wanted = new Set(ids);
        for (const file of this.allCommitteeFiles) {
          if (wanted.has(file.id)) {
            this.committeeFiles.set(file.id, file);
          }
        }
        const missing = ids.filter(id => !this.committeeFiles.has(id));
        if (missing.length > 0) {
          this.logger.warn("resolveCommitteeFiles:no files found for ids:", missing);
        }
        await this.resolveCommitteeFilePagePaths(ids);
      }
    }

  committeeFilePagePathById = new Map<string, string>();

  async resolveCommitteeFilePagePaths(ids: string[]): Promise<void> {
      const unresolved = ids.filter(id => !this.committeeFilePagePathById.has(id));
      if (!(unresolved.length === 0)) {
        try {
          const pages: PageContent[] = await this.pageContentService.all({
            criteria: {"rows.committeeDocuments.fileIds": {$in: unresolved}}
          });
          pages.forEach(page => (page.rows ?? []).forEach(row => (row.committeeDocuments?.fileIds ?? []).forEach(fileId => {
            if (unresolved.includes(fileId) && !this.committeeFilePagePathById.has(fileId)) {
              this.committeeFilePagePathById.set(fileId, page.path);
            }
          })));
        } catch (error) {
          this.logger.warn("resolveCommitteeFilePagePaths failed for ids:", unresolved, error);
        }
      }
    }

  committeeFileLinkPath(file: CommitteeFile): string {
      return this.session.state.context?.sourcePagePath || this.committeeFilePagePathById.get(file.id) || "";
    }

  async resolveCommitteeFileLinksForSend(): Promise<void> {
      const ids = this.allFragmentCommitteeFileIds();
      if (ids.length > 0) {
        if (this.allCommitteeFiles.length === 0) {
          await this.loadAllCommitteeFiles();
        }
        await this.resolveCommitteeFiles(ids);
        this.session.contentChanged.next();
      }
      const unresolved = this.committeeFileFragmentsFrom(this.session.state.fragmentOrder ?? []).flatMap(fragment => this.committeeFilesFor(fragment).filter(file => {
        const include = resolvedCommitteeFileEmailInclude(file, fragment.committeeFileInclude || null);
        const sendsLink = include === CommitteeFileEmailInclude.LINK || include === CommitteeFileEmailInclude.BOTH;
        return sendsLink && this.committeeDisplayService.isComposedDocument(file) && !this.committeeFileLinkPath(file);
      }));
      if (unresolved.length > 0) {
        const titles = unresolved.map(file => this.committeeDisplayService.fileTitle(file)).join(", ");
        const isPlural = unresolved.length > 1;
        throw new Error(`This email links to a committee ${isPlural ? "documents" : "document"} (${titles}) that ${isPlural ? "aren't" : "isn't"} published on any committee page yet, so there's no web address for the email to point to. Add ${isPlural ? "them" : "it"} to a committee documents page, or remove ${isPlural ? "them" : "it"} from the email.`);
      }
    }

  allFragmentCommitteeFileIds(): string[] {
      const collect = (list: ComposerFragment[]): string[] => list.flatMap(fragment => {
        if (fragment.kind === ComposerFragmentKind.COMMITTEE_FILE) {
          return fragment.committeeFileIds ?? [];
        } else {
          if (fragment.kind === ComposerFragmentKind.MULTI_COLUMN) {
            return (fragment.columns ?? []).flatMap(column => collect(column));
          } else {
            return [];
          }
        }
      });
      return Array.from(new Set(collect(this.session.state.fragmentOrder ?? [])));
    }

  hasCommitteeFileFragment(): boolean {
      return this.fragmentEditor.hasFragmentKindAtTopLevel(this.session.state, ComposerFragmentKind.COMMITTEE_FILE);
    }

  ensureCommitteeFileFragmentForIds(ids: string[]): void {
      this.fragmentEditor.ensureFragmentOrder(this.session.state);
      const list = this.session.state.fragmentOrder ?? [];
      const existing = list.find(f => f.kind === ComposerFragmentKind.COMMITTEE_FILE);
      if (existing) {
        const merged = Array.from(new Set([...(existing.committeeFileIds ?? []), ...ids]));
        existing.committeeFileIds = merged;
        this.session.state.fragmentOrder = [...list];
        this.fragmentEditor.expandedFragmentIds.add(existing.id);
      } else {
        const introIdx = list.findIndex(f => f.kind === ComposerFragmentKind.INTRO);
        const insertAt = introIdx >= 0 ? introIdx + 1 : 0;
        const newFragment: ComposerFragment = {
          kind: ComposerFragmentKind.COMMITTEE_FILE,
          id: this.stringUtils.kebabCase(`committee-file-${this.dateUtils.dateTimeNow().toMillis()}`),
          dividerAfter: SectionDividerStyle.THIN_YELLOW,
          committeeFileIds: [...ids],
          committeeFileInclude: CommitteeFileEmailInclude.CONTENT
        };
        this.session.state.fragmentOrder = [...list.slice(0, insertAt), newFragment, ...list.slice(insertAt)];
        this.fragmentEditor.expandedFragmentIds.add(newFragment.id);
      }
    }

  addCommitteeFileFragment(): void {
      this.fragmentEditor.ensureFragmentOrder(this.session.state);
      const newFragment: ComposerFragment = {
        kind: ComposerFragmentKind.COMMITTEE_FILE,
        id: this.stringUtils.kebabCase(`committee-file-${this.dateUtils.dateTimeNow().toMillis()}`),
        dividerAfter: SectionDividerStyle.THIN_YELLOW,
        committeeFileIds: [],
        committeeFileInclude: CommitteeFileEmailInclude.CONTENT
      };
      this.fragmentEditor.insertAboveSignoffAtTopLevel(this.session.state, newFragment);
      this.fragmentEditor.expandedFragmentIds.add(newFragment.id);
    }

  async onAddCommitteeFileFragmentClicked(): Promise<void> {
      if (this.allCommitteeFiles.length === 0) {
        await this.loadAllCommitteeFiles();
      }
      this.addCommitteeFileFragment();
    }

  committeeFilesFor(fragment: ComposerFragment): CommitteeFile[] {
      const ids = fragment.committeeFileIds ?? [];
      return ids
        .map(id => this.committeeFiles.get(id))
        .filter((file): file is CommitteeFile => !!file);
    }

  unresolvedCommitteeFileIdsFor(fragment: ComposerFragment): string[] {
      return (fragment.committeeFileIds ?? []).filter(id => !this.committeeFiles.has(id));
    }

  removeCommitteeFile(fragment: ComposerFragment, fileId: string): void {
      this.onCommitteeFileIdsChanged(fragment, (fragment.committeeFileIds ?? []).filter(id => id !== fileId));
    }

  committeeFileNotificationItemFor(file: CommitteeFile): NotificationItem {
      const fileType = (file.fileType ?? "").trim();
      const title = this.committeeDisplayService.fileTitle(file);
      const subject = fileType ? `${fileType} - ${title}` : title;
      return {callToAction: null, image: null, subject, text: ""};
    }

  committeeFileDownloadLabel(file: CommitteeFile): string {
      const fileType = (file.fileType ?? "").trim();
      const action = this.committeeDisplayService.isComposedDocument(file) ? "View" : "Download";
      return fileType ? `${action} ${fileType}` : action;
    }

  committeeFileDownloadFilename(file: CommitteeFile): string {
      return file.fileNameData?.originalFileName || file.fileNameData?.awsFileName || file.document?.title || "";
    }

  committeeFileFragmentHasMarkdown(fragment: ComposerFragment): boolean {
      return this.committeeFilesFor(fragment).some(file => hasCommitteeDocumentContent(file));
    }

  committeeFileInclude(fragment: ComposerFragment): CommitteeFileEmailInclude {
      return fragment.committeeFileInclude || CommitteeFileEmailInclude.CONTENT;
    }

  setCommitteeFileInclude(fragment: ComposerFragment, include: CommitteeFileEmailInclude): void {
      fragment.committeeFileInclude = include;
      this.session.state.fragmentOrder = [...(this.session.state.fragmentOrder ?? [])];
      this.session.contentChanged.next();
    }

  committeeFileShowsContent(fragment: ComposerFragment, file: CommitteeFile): boolean {
      return committeeFileEmailSendsContent(resolvedCommitteeFileEmailInclude(file, this.committeeFileInclude(fragment)));
    }

  committeeFileShowsDownloadLink(fragment: ComposerFragment, file: CommitteeFile): boolean {
      return !this.committeeFileShowsContent(fragment, file) && !!this.committeeFileDownloadFilename(file);
    }

  committeeFileDateLabel(file: CommitteeFile): string {
      if (!file?.eventDate) {
        return "";
      } else if (this.dateUtils.isDateOnly(file.eventDate)) {
        return this.dateUtils.displayDate(file.eventDate);
      } else {
        return `${this.dateUtils.displayDate(file.eventDate)}, ${this.dateUtils.asString(file.eventDate, undefined, this.dateUtils.formats.displayTime)}`;
      }
    }

  committeeFileMarkdownForEmail(file: CommitteeFile): string {
      return committeeMarkdownForEmail(file.document?.markdown || "");
    }

  committeeFileFragmentsFrom(list: ComposerFragment[]): ComposerFragment[] {
      return (list || []).reduce((collected: ComposerFragment[], fragment) => {
        if (fragment.kind === ComposerFragmentKind.COMMITTEE_FILE) {
          return [...collected, fragment];
        } else if (fragment.kind === ComposerFragmentKind.MULTI_COLUMN) {
          return [...collected, ...(fragment.columns || []).flatMap(column => this.committeeFileFragmentsFrom(column))];
        } else {
          return collected;
        }
      }, []);
    }

  onCommitteeFileIdsChanged(fragment: ComposerFragment, ids: string[]): void {
      fragment.committeeFileIds = isArray(ids) ? Array.from(new Set(ids)) : [];
      this.session.state.fragmentOrder = [...(this.session.state.fragmentOrder ?? [])];
      void this.resolveCommitteeFiles(this.allFragmentCommitteeFileIds());
    }

  async onCommitteeFileUrlChanged(value: string): Promise<void> {
      this.committeeFileUrlInput = value ?? "";
      this.committeeFileUrlError = null;
      const path = this.normaliseSiteLinkPath(this.committeeFileUrlInput);
      if (!path) {
        this.committeeFileUrlAllowedIds = null;
      } else {
        try {
          const page = await this.pageContentService.findByPath(path);
          const ids = this.collectCommitteeFileIdsFromPage(page);
          if (ids.length === 0) {
            this.committeeFileUrlAllowedIds = [];
            this.committeeFileUrlError = `${path} doesn't list any committee files`;
          } else {
            this.committeeFileUrlAllowedIds = ids;
          }
        } catch (error) {
          this.logger.error("onCommitteeFileUrlChanged failed", error);
          this.committeeFileUrlAllowedIds = null;
          this.committeeFileUrlError = `Couldn't load page at ${path}`;
        }
      }
    }

  normaliseSiteLinkPath(value: string): string | null {
      const trimmed = (value ?? "").trim();
      if (!trimmed) {
        return null;
      } else {
        if (/^https?:\/\//i.test(trimmed) || trimmed.includes("://")) {
          try {
            const url = new URL(trimmed);
            return url.pathname.replace(/^\/+/, "");
          } catch {
            return null;
          }
        }
        return trimmed.replace(/^\/+/, "");
      }
    }

  collectCommitteeFileIdsFromPage(page: PageContent | null | undefined): string[] {
      if (!page?.rows) {
        return [];
      } else {
        const ids = new Set<string>();
        for (const row of page.rows) {
          const fileIds = row?.committeeDocuments?.fileIds;
          if (fileIds?.length) {
            fileIds.forEach(id => ids.add(id));
          }
        }
        return Array.from(ids);
      }
    }

  absoluteSourcePageUrl(): string {
      const path = this.session.state.context?.sourcePagePath;
      if (!path) {
        return "";
      } else {
        return this.urlService.baseUrl() + "/" + path;
      }
    }

  sourcePageTitleOrFallback(): string {
      const explicit = this.session.state.context?.sourcePageTitle;
      if (explicit) {
        return explicit;
      } else {
        const path = this.session.state.context?.sourcePagePath;
        if (!path) {
          return "";
        } else {
          return this.pageService.titleFromPath(path);
        }
      }
    }
}

import { inject, Injectable } from "@angular/core";
import { Router } from "@angular/router";
import { isObject, isUndefined } from "es-toolkit/compat";
import { NgxLoggerLevel } from "ngx-logger";
import { ExtendedGroupEvent } from "../../models/group-event.model";
import { ContentMetadata, ContentMetadataItem, WalkAlbumLink } from "../../models/content-metadata.model";
import { ContentTemplateType, PageContent, PageContentRow, PageContentType, USER_TEMPLATES_PATH_PREFIX } from "../../models/content-text.model";
import { RootFolder, SystemConfig } from "../../models/system.model";
import { ContentMetadataService } from "../content-metadata.service";
import { PageContentService } from "../page-content.service";
import { PageContentActionsService } from "../page-content-actions.service";
import { UrlService } from "../url.service";
import { DateUtilsService } from "../date-utils.service";
import { SystemConfigService } from "../system/system-config.service";
import { AiService } from "../ai/ai.service";
import { LoggerFactory } from "../logger-factory.service";
import { RamblersEventType } from "../../models/ramblers-walks-manager";
import { walkLeaderFirstNameForAlbumThanks } from "../../functions/walks/walk-leader-fields";
import { SiteEditService } from "../../site-edit/site-edit.service";

@Injectable({
  providedIn: "root"
})
export class CreateWalkAlbumService {

  private logger = inject(LoggerFactory).createLogger("CreateWalkAlbumService", NgxLoggerLevel.ERROR);
  private contentMetadataService = inject(ContentMetadataService);
  private pageContentService = inject(PageContentService);
  private pageContentActions = inject(PageContentActionsService);
  private urlService = inject(UrlService);
  private router = inject(Router);
  private dateUtils = inject(DateUtilsService);
  private systemConfigService = inject(SystemConfigService);
  private aiService = inject(AiService);
  private siteEditService = inject(SiteEditService);
  private config: SystemConfig;
  private readonly WALK_ALBUM_TEMPLATE_PATH = `${USER_TEMPLATES_PATH_PREFIX}walk-album`;

  constructor() {
    this.systemConfigService.events().subscribe(config => this.config = config);
  }

  private navAreaFor(eventType: RamblersEventType): string {
    const buttons = this.config?.header?.navigationButtons || [];
    const segments = buttons.map(button => (button.href || "").replace(/^\/+/, "").split("/")[0]).filter(Boolean);
    if (eventType === RamblersEventType.GROUP_EVENT) {
      const knownSocial = segments.find(segment => segment === "social" || segment === "socials" || segment === "group-events");
      if (knownSocial) {
        return knownSocial;
      }
      const socialButton = buttons.find(button => /social|group.event/i.test(button.href || "") || /social|group event/i.test(button.title || ""));
      return (socialButton?.href || "").replace(/^\/+/, "").split("/")[0] || "social";
    }
    const knownWalks = segments.find(segment => segment === "walks" || segment === "go-walking");
    if (knownWalks) {
      return knownWalks;
    }
    const walkButton = buttons.find(button => /walk/i.test(button.href || "") || /walk/i.test(button.title || ""));
    return (walkButton?.href || "").replace(/^\/+/, "").split("/")[0] || "walks";
  }

  photoAlbumBasePath(eventType: RamblersEventType = RamblersEventType.GROUP_WALK): string {
    const group = this.config?.group;
    const configuredRaw = eventType === RamblersEventType.GROUP_EVENT
      ? group?.socialPhotoAlbumBasePath
      : group?.walkPhotoAlbumBasePath;
    const configured = (configuredRaw || "").trim().replace(/^\/+|\/+$/g, "");
    if (configured) {
      return configured;
    }
    return `${this.navAreaFor(eventType)}/photos`;
  }

  private slugFor(walk: ExtendedGroupEvent): string {
    const fromUrl = (walk.groupEvent?.url || "").replace(/^.*\//, "").trim();
    return fromUrl || (walk.groupEvent?.title || "walk").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  private yearFor(walk: ExtendedGroupEvent): string {
    const startIso = walk.groupEvent?.start_date_time;
    return String(startIso
      ? this.dateUtils.yearFromDate(this.dateUtils.asValue(startIso))
      : this.dateUtils.yearFromDate(this.dateUtils.dateTimeNowAsValue()));
  }

  albumNameFor(walk: ExtendedGroupEvent, eventType: RamblersEventType = RamblersEventType.GROUP_WALK): string {
    return `${this.photoAlbumBasePath(eventType)}/${this.yearFor(walk)}/${this.slugFor(walk)}`;
  }

  private eventIdsFor(walk: ExtendedGroupEvent): string[] {
    return [walk?.id, walk?.groupEvent?.id, walk?.ramblersId]
      .filter(Boolean)
      .map(id => String(id))
      .filter((id, index, all) => all.indexOf(id) === index);
  }

  async existingAlbumPathFor(walk: ExtendedGroupEvent): Promise<string | null> {
    const link = await this.existingAlbumLinkFor(walk);
    return link?.path || null;
  }

  async existingAlbumLinkFor(walk: ExtendedGroupEvent): Promise<WalkAlbumLink | null> {
    const eventIds = this.eventIdsFor(walk);
    if (eventIds.length === 0) {
      return null;
    }
    const pages = await this.pageContentService.findByCarouselEventIds(eventIds).catch(() => []);
    const page = this.preferredPageReferencingEvent(pages, eventIds);
    if (!page?.path) {
      return null;
    }
    return this.albumLinkFromPage(page, page.path, eventIds);
  }

  private preferredPageReferencingEvent(pages: PageContent[], eventIds: string[]): PageContent | null {
    const withPath = (pages || []).filter(page => !!page?.path);
    if (withPath.length === 0) {
      return null;
    }
    const scored = withPath.map(page => {
      const path = page.path || "";
      const segments = path.split("/").filter(Boolean).length;
      const matchingRows = (page.rows || []).filter(row => this.rowReferencesEvent(row, eventIds));
      const albumRows = matchingRows.filter(row => row?.type === PageContentType.ALBUM || !!row?.carousel?.name);
      const carouselNameLooksLikeAlbum = albumRows.some(row => {
        const name = row?.carousel?.name || "";
        return name.includes("/");
      });
      return {
        page,
        score: (albumRows.length > 0 ? 200 : 0)
          + (carouselNameLooksLikeAlbum ? 50 : 0)
          + segments
          + matchingRows.length
      };
    });
    return scored.reduce((best, candidate) => {
      if (!best || candidate.score > best.score) {
        return candidate;
      }
      return best;
    }, null as { page: PageContent; score: number } | null)?.page || null;
  }

  private rowReferencesEvent(row: PageContentRow, eventIds: string[]): boolean {
    const eventId = row?.carousel?.eventId;
    return eventId != null && eventIds.includes(String(eventId));
  }

  private async albumLinkFromPage(page: PageContent, path: string, eventIds: string[]): Promise<WalkAlbumLink | null> {
    const matchingRow = (page.rows || []).find(row => this.rowReferencesEvent(row, eventIds));
    const albumRow = matchingRow
      || (page.rows || []).find(row => row?.carousel?.name || row?.type === PageContentType.ALBUM);
    const albumName = albumRow?.carousel?.name || path;
    const album = await this.contentMetadataService.items(RootFolder.carousels, albumName).catch(() => null)
      || (albumName !== path ? await this.contentMetadataService.items(RootFolder.carousels, path).catch(() => null) : null);
    return {
      path,
      albumName: album?.name || albumName,
      coverImageUrl: this.coverImageUrlFor(album)
    };
  }

  private coverImageUrlFor(album: ContentMetadata | null): string | null {
    const files = album?.files?.filter(file => !!file?.image) || [];
    if (files.length === 0) {
      return null;
    }
    const cover: ContentMetadataItem = album.coverImage
      ? files.find(file => file.image === album.coverImage) || files[0]
      : files[0];
    return this.urlService.imageSourceFor(cover, album) || null;
  }

  private async ensureWalkAlbumTemplate(): Promise<PageContent> {
    const existing = await this.pageContentService.findByPath(this.WALK_ALBUM_TEMPLATE_PATH).catch(() => null);
    if (existing?.id) {
      return existing;
    }
    const template: PageContent = {
      path: this.WALK_ALBUM_TEMPLATE_PATH,
      rows: [this.pageContentActions.defaultRowFor(PageContentType.ALBUM)],
      migrationTemplate: {
        isTemplate: true,
        templateType: ContentTemplateType.USER_TEMPLATE,
        templateName: "Walk album",
        templateDescription: "The layout used for walk photo albums. Edit this page to change the style of all future walk albums."
      }
    };
    this.logger.info("seeding walk album template at", this.WALK_ALBUM_TEMPLATE_PATH);
    return this.pageContentService.createOrUpdate(template);
  }

  private async preAlbumTextFor(walk: ExtendedGroupEvent): Promise<string> {
    const description = walk?.groupEvent?.description || "";
    if (!description) {
      return "";
    }
    const walkLeaderFirstName = walkLeaderFirstNameForAlbumThanks(walk);
    const input = walkLeaderFirstName
      ? `Walk leader first name: ${walkLeaderFirstName}\n\nDescription:\n${description}`
      : description;
    try {
      return await this.aiService.rewrite(input) || description;
    } catch (error) {
      this.logger.warn("AI rewrite failed, using the walk description as-is", error);
      return description;
    }
  }

  private applyWalkToRows(rows: PageContentRow[], walk: ExtendedGroupEvent, albumName: string, eventDateMs: number | null, preAlbumText: string): void {
    const albumIndex = rows.findIndex(row => row.type === PageContentType.ALBUM);
    const albumRow = albumIndex >= 0 ? rows[albumIndex] : this.pageContentActions.defaultRowFor(PageContentType.ALBUM);
    albumRow.carousel = {
      ...albumRow.carousel,
      name: albumName,
      title: this.dateUtils.displayDay(walk.groupEvent?.start_date_time),
      subtitle: walk.groupEvent?.title,
      eventId: walk.groupEvent?.id || walk.id,
      ...(eventDateMs != null ? {eventDate: eventDateMs} : {}),
      eventType: "walks",
      showPreAlbumText: true,
      preAlbumText
    };
    if (albumIndex < 0) {
      rows.push(albumRow);
    }
  }

  private autoCoverAlbumNames: Record<string, boolean> = {};
  private returnToWalkPathSegments: string[] | null = null;
  private readonly AUTO_COVER_STORAGE_KEY = "ngx-ramblers.auto-cover-albums";

  private eventTypeFor(walk: ExtendedGroupEvent): RamblersEventType {
    if (walk?.groupEvent?.item_type === RamblersEventType.GROUP_EVENT) {
      return RamblersEventType.GROUP_EVENT;
    }
    return RamblersEventType.GROUP_WALK;
  }

  async createFromWalk(walk: ExtendedGroupEvent): Promise<string> {
    const existingLink = await this.existingAlbumLinkFor(walk);
    if (existingLink?.path) {
      this.markAlbumForAutoCover(existingLink.albumName || existingLink.path);
      return existingLink.path;
    }
    const eventType = this.eventTypeFor(walk);
    const albumName = this.albumNameFor(walk, eventType);
    this.markAlbumForAutoCover(albumName);
    await this.ensureContentMetadata(albumName);
    await this.createAlbumPageForWalk(walk, albumName);
    return albumName;
  }

  private async ensureContentMetadata(albumName: string): Promise<void> {
    const existing = await this.contentMetadataService.items(RootFolder.carousels, albumName).catch(() => null);
    if (existing?.id) {
      return;
    }
    await this.contentMetadataService.create({
      rootFolder: RootFolder.carousels,
      name: albumName,
      files: [],
      imageTags: []
    });
  }

  private async createAlbumPageForWalk(walk: ExtendedGroupEvent, albumName: string): Promise<void> {
    const existingPage = await this.pageContentService.findByPath(albumName).catch(() => null);
    if (existingPage?.id) {
      return;
    }
    const startIso = walk.groupEvent?.start_date_time;
    const eventDateMs = startIso ? this.dateUtils.asValue(startIso) : null;
    const preAlbumText = await this.preAlbumTextFor(walk);
    const template = await this.ensureWalkAlbumTemplate();
    const rows = await this.pageContentActions.copyContentTextIdsInRows(template.rows || []);
    this.applyWalkToRows(rows, walk, albumName, eventDateMs, preAlbumText);
    await this.pageContentService.createOrUpdate({path: albumName, rows});
  }

  async ensureAlbumPageAfterSave(albumName: string): Promise<void> {
    return;
  }

  clearPendingAlbum(albumName: string): void {
    this.clearAutoCoverMark(albumName);
  }

  rememberReturnToWalk(pathSegments: string[]): void {
    const segments = (pathSegments || []).filter(Boolean);
    this.returnToWalkPathSegments = segments.length > 0 ? segments : null;
  }

  clearReturnToWalk(): void {
    this.returnToWalkPathSegments = null;
  }

  markAlbumForAutoCover(albumName: string): void {
    if (!albumName) {
      return;
    }
    this.autoCoverAlbumNames[albumName] = true;
    const stored = this.readStoredAutoCoverMarks();
    stored[albumName] = true;
    this.writeStoredAutoCoverMarks(stored);
  }

  private isMarkedForAutoCover(albumName: string): boolean {
    if (!albumName) {
      return false;
    }
    if (this.autoCoverAlbumNames[albumName]) {
      return true;
    }
    const stored = this.readStoredAutoCoverMarks();
    if (stored[albumName]) {
      this.autoCoverAlbumNames[albumName] = true;
      return true;
    }
    return false;
  }

  private clearAutoCoverMark(albumName: string): void {
    if (!albumName) {
      return;
    }
    delete this.autoCoverAlbumNames[albumName];
    const stored = this.readStoredAutoCoverMarks();
    if (stored[albumName]) {
      delete stored[albumName];
      this.writeStoredAutoCoverMarks(stored);
    }
  }

  private readStoredAutoCoverMarks(): Record<string, boolean> {
    if (isUndefined(window)) {
      return {};
    }
    try {
      const raw = window.sessionStorage.getItem(this.AUTO_COVER_STORAGE_KEY);
      if (!raw) {
        return {};
      }
      const parsed = JSON.parse(raw);
      return isObject(parsed) ? parsed as Record<string, boolean> : {};
    } catch (error) {
      this.logger.warn("failed to read auto-cover marks", error);
      return {};
    }
  }

  private writeStoredAutoCoverMarks(marks: Record<string, boolean>): void {
    if (isUndefined(window)) {
      return;
    }
    try {
      window.sessionStorage.setItem(this.AUTO_COVER_STORAGE_KEY, JSON.stringify(marks));
    } catch (error) {
      this.logger.warn("failed to persist auto-cover marks", error);
    }
  }

  async navigateBackToWalkIfNeeded(_albumName: string): Promise<boolean> {
    const segments = this.returnToWalkPathSegments;
    if (!segments?.length) {
      return false;
    }
    this.returnToWalkPathSegments = null;
    this.logger.info("navigateBackToWalkIfNeeded: returning to walk at", segments);
    if (this.siteEditService.active()) {
      this.siteEditService.toggle(false);
    }
    const path = "/" + segments.join("/");
    await this.router.navigateByUrl(path);
    return true;
  }

  async applyAutoCoverIfNeeded(album: ContentMetadata, options?: { force?: boolean }): Promise<ContentMetadata> {
    if (!album?.name || album.coverImage) {
      return album;
    }
    const files = (album.files || []).filter(file => !!file?.image);
    if (files.length === 0) {
      return album;
    }
    const shouldAutoCover = !!options?.force || this.isMarkedForAutoCover(album.name);
    if (!shouldAutoCover) {
      this.logger.info("applyAutoCoverIfNeeded: skipping", album.name, "not marked for auto cover");
      return album;
    }
    if (files.length === 1) {
      album.coverImage = files[0].image;
      this.clearAutoCoverMark(album.name);
      return this.contentMetadataService.createOrUpdate(album);
    }
    const rootFolder = album.rootFolder || RootFolder.carousels;
    const candidates = files.map(file => {
      const s3Key = file.image.includes("/")
        ? file.image.replace(/^\/+/, "").replace(/^api\/aws\/s3\//, "")
        : `${rootFolder}/${album.name}/${file.image}`.replace(/\/+/g, "/");
      return {
        image: file.image,
        s3Key,
        url: this.urlService.absoluteUrlFor(this.urlService.imageSourceFor(file, album))
      };
    });
    try {
      this.logger.info("applyAutoCoverIfNeeded: asking AI to choose cover for", album.name, "from", candidates.length, "images");
      const chosen = await this.aiService.chooseCoverImage(candidates, rootFolder, album.name);
      const match = files.find(file => file.image === chosen);
      album.coverImage = match?.image || files[0].image;
      this.logger.info("applyAutoCoverIfNeeded: cover set to", album.coverImage);
    } catch (error) {
      this.logger.warn("applyAutoCoverIfNeeded failed, using first image", error);
      album.coverImage = files[0].image;
    }
    this.clearAutoCoverMark(album.name);
    return this.contentMetadataService.createOrUpdate(album);
  }
}

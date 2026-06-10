import { inject, Injectable } from "@angular/core";
import { cloneDeep } from "es-toolkit/compat";
import { last } from "es-toolkit/compat";
import { ModalOptions } from "ngx-bootstrap/modal";
import { NgxLoggerLevel } from "ngx-logger";
import { Observable } from "rxjs";
import { CommitteeFile, GroupEventType, groupEventTypeFor } from "../../models/committee.model";
import { BROWSER_VIEWABLE_FILE_EXTENSIONS, CONVERTIBLE_DOCUMENT_EXTENSIONS, FILE_ICON_EXTENSIONS, FileServeDisposition, OFFICE_FILE_EXTENSIONS } from "../../models/aws-object.model";
import { EM_DASH_WITH_SPACES } from "../../models/content-text.model";
import { Confirm, StoredValue } from "../../models/ui-actions";
import { CommitteeConfigService } from "../../services/committee/commitee-config.service";
import { CommitteeFileService } from "../../services/committee/committee-file.service";
import { CommitteeReferenceData } from "../../services/committee/committee-reference-data";
import { ContentMetadataService } from "../../services/content-metadata.service";
import { DateUtilsService } from "../../services/date-utils.service";
import { Logger, LoggerFactory } from "../../services/logger-factory.service";
import { MemberLoginService } from "../../services/member/member-login.service";
import { AlertInstance } from "../../services/notifier.service";
import { StringUtilsService } from "../../services/string-utils.service";
import { UrlService } from "../../services/url.service";
import { RamblersEventType } from "../../models/ramblers-walks-manager";
import { ExtendedGroupEvent } from "../../models/group-event.model";

@Injectable({
  providedIn: "root"
})

export class CommitteeDisplayService {
  private logger: Logger = inject(LoggerFactory).createLogger("CommitteeDisplayService", NgxLoggerLevel.ERROR);
  private memberLoginService = inject(MemberLoginService);
  urlService = inject(UrlService);
  private stringUtils = inject(StringUtilsService);
  private dateUtils = inject(DateUtilsService);
  private committeeFileService = inject(CommitteeFileService);
  private contentMetadataService = inject(ContentMetadataService);
  private committeeConfig = inject(CommitteeConfigService);
  public committeeFileBaseUrl = this.contentMetadataService.baseUrl("committeeFiles");
  public committeeReferenceData: CommitteeReferenceData;
  public confirm: Confirm = new Confirm();

  constructor() {
    this.committeeConfig.committeeReferenceDataEvents().subscribe(data => this.committeeReferenceData = data);
    this.logger.debug("this.memberLoginService", this.memberLoginService.loggedInMember());
  }

  configEvents(): Observable<CommitteeReferenceData> {
    return this.committeeConfig.committeeReferenceDataEvents();
  }

  defaultCommitteeFile(): CommitteeFile {
    return cloneDeep({
      createdDate: this.dateUtils.dateTimeNow().toMillis(),
      eventDate: this.dateUtils.dateTimeNowNoTime().toMillis(),
      fileType: this.fileTypes()[0]?.description
    });
  }

  createModalOptions(initialState?: any): ModalOptions {
    return {
      class: "modal-xl",
      animated: false,
      backdrop: "static",
      ignoreBackdropClick: false,
      keyboard: true,
      focus: true,
      show: true,
      initialState: cloneDeep(initialState)
    };
  }

  fileTypes() {
    return this.committeeReferenceData?.fileTypes();
  }

  allowSend() {
    return this.memberLoginService.allowFileAdmin();
  }

  allowAddCommitteeFile() {
    return this.fileTypes() && this.memberLoginService.allowFileAdmin();
  }

  allowEditCommitteeFile(committeeFile: CommitteeFile) {
    return this.allowAddCommitteeFile() && committeeFile?.id;
  }

  allowDeleteCommitteeFile(committeeFile: CommitteeFile) {
    return this.allowEditCommitteeFile(committeeFile);
  }

  confirmDeleteCommitteeFile(notify: AlertInstance, committeeFile: CommitteeFile): Promise<CommitteeFile> {
    return this.committeeFileService.delete(committeeFile)
      .then((response) => {
        this.confirm.clear();
        return response;
      });
  }

  isComposedDocument(committeeFile: CommitteeFile): boolean {
    return !!committeeFile?.document;
  }

  documentPageUrl(committeeFile: CommitteeFile, sourcePagePath?: string, base: string = this.urlService.baseUrl()): string {
    const slug = this.committeeFileSlug(committeeFile);
    if (committeeFile?.id && slug) {
      const pagePath = sourcePagePath || this.urlService.urlPath();
      const param = this.isComposedDocument(committeeFile) ? StoredValue.COMMITTEE_DOCUMENT : StoredValue.COMMITTEE_FILE_VIEW;
      return `${base}/${pagePath}?${param}=${slug}`;
    } else {
      return "";
    }
  }

  composedDocumentPrintUrl(committeeFile: CommitteeFile, sourcePagePath?: string): string {
    const url = this.documentPageUrl(committeeFile, sourcePagePath);
    return url ? `${url}&print=true` : "";
  }

  fileUrl(committeeFile: CommitteeFile, sourcePagePath?: string) {
    if (this.isComposedDocument(committeeFile)) {
      return this.documentPageUrl(committeeFile, sourcePagePath);
    } else {
      return this.committeeFileUrl(committeeFile, FileServeDisposition.DOWNLOAD);
    }
  }

  viewUrl(committeeFile: CommitteeFile, sourcePagePath?: string) {
    if (committeeFile?.id && this.canViewInBrowser(committeeFile)) {
      return this.documentPageUrl(committeeFile, sourcePagePath);
    } else {
      return this.directViewUrl(committeeFile);
    }
  }

  directViewUrl(committeeFile: CommitteeFile) {
    if (this.isComposedDocument(committeeFile)) {
      return this.documentPageUrl(committeeFile);
    } else if (this.isOfficeViewable(committeeFile)) {
      return this.officeViewerUrl(committeeFile);
    } else {
      return this.committeeFileUrl(committeeFile, FileServeDisposition.INLINE);
    }
  }

  attachmentEmbedUrl(committeeFile: CommitteeFile): string {
    if (this.isOfficeViewable(committeeFile)) {
      const source = this.committeeFileUrl(committeeFile, undefined, this.urlService.publicBaseUrl());
      return source ? `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(source)}` : "";
    } else {
      return this.committeeFileUrl(committeeFile, FileServeDisposition.INLINE);
    }
  }

  canViewInBrowser(committeeFile: CommitteeFile): boolean {
    return this.isComposedDocument(committeeFile) || this.isBrowserViewable(committeeFile) || this.isOfficeViewable(committeeFile);
  }

  canConvertToComposedDocument(committeeFile: CommitteeFile): boolean {
    return !this.isComposedDocument(committeeFile)
      && this.fileExtensionIs(committeeFile?.fileNameData?.awsFileName, CONVERTIBLE_DOCUMENT_EXTENSIONS);
  }

  private isBrowserViewable(committeeFile: CommitteeFile): boolean {
    return this.fileExtensionIs(committeeFile?.fileNameData?.awsFileName, BROWSER_VIEWABLE_FILE_EXTENSIONS);
  }

  private isOfficeViewable(committeeFile: CommitteeFile): boolean {
    return this.fileExtensionIs(committeeFile?.fileNameData?.awsFileName, OFFICE_FILE_EXTENSIONS);
  }

  private officeViewerUrl(committeeFile: CommitteeFile): string {
    const source = this.committeeFileUrl(committeeFile, undefined, this.urlService.publicBaseUrl());
    return source ? `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(source)}` : "";
  }

  private committeeFileUrl(committeeFile: CommitteeFile, disposition?: FileServeDisposition, base: string = this.urlService.baseUrl()) {
    if (!committeeFile) {
      return "";
    } else if (this.urlService.isRemoteUrl(committeeFile?.fileNameData?.awsFileName)) {
      return committeeFile.fileNameData.awsFileName;
    } else {
      const baseUrl = base + "/" + this.committeeFileBaseUrl + "/" + committeeFile?.fileNameData?.awsFileName;
      const originalFileName = committeeFile?.fileNameData?.originalFileName;
      return originalFileName && disposition
        ? `${baseUrl}?${disposition}=${encodeURIComponent(originalFileName)}`
        : baseUrl;
    }
  }

  committeeFileSlug(committeeFile: CommitteeFile): string {
    const dateStr = this.dateUtils.asString(committeeFile?.eventDate, undefined, this.dateUtils.formats.displayDateTh);
    const title = committeeFile?.fileNameData?.title || committeeFile?.document?.title || committeeFile?.fileType || "";
    return this.stringUtils.kebabCase(title, dateStr).replace(/(\d)-(st|nd|rd|th)(?=-|$)/g, "$1$2");
  }

  fileTitle(committeeFile: CommitteeFile) {
    if (!committeeFile) {
      return "";
    }
    const title = committeeFile.fileNameData?.title || committeeFile.document?.title || "";
    const dateStr = this.dateUtils.asString(committeeFile.eventDate, undefined, this.dateUtils.formats.displayDateTh);
    return title ? `${dateStr}${EM_DASH_WITH_SPACES}${title}` : dateStr;
  }

  fileExtensionIs(fileName, extensions: string[]) {
    return extensions.includes(this.fileExtension(fileName));
  }

  fileExtension(fileName: string) {
    return fileName ? last(fileName.split(".")).toLowerCase() : "";
  }

  iconFile(committeeFile: CommitteeFile): string {
    if (this.isComposedDocument(committeeFile)) {
      return "icon-composed.svg";
    } else if (this.fileExtensionIs(committeeFile?.fileNameData?.awsFileName, FILE_ICON_EXTENSIONS)) {
      return "icon-" + this.fileExtension(committeeFile?.fileNameData?.awsFileName).substring(0, 3) + ".svg";
    } else {
      return "icon-default.svg";
    }
  }

  ramblersEventType(walk: ExtendedGroupEvent): RamblersEventType {
    return walk?.groupEvent?.item_type || RamblersEventType.GROUP_WALK;
  }

  groupEventType(walk: ExtendedGroupEvent): GroupEventType {
    switch (this.ramblersEventType(walk)) {
      case RamblersEventType.GROUP_WALK:
        return groupEventTypeFor("walk");
      case RamblersEventType.GROUP_EVENT:
        return groupEventTypeFor("socialEvent");
      case RamblersEventType.WELLBEING_WALK:
        return groupEventTypeFor("walk");
    }
  }

}

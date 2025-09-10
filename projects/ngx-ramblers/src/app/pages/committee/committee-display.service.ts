import { inject, Injectable } from "@angular/core";
import { cloneDeep } from "es-toolkit/compat";
import { last } from "es-toolkit/compat";
import { ModalOptions } from "ngx-bootstrap/modal";
import { NgxLoggerLevel } from "ngx-logger";
import { Observable } from "rxjs";
import { CommitteeFile, GroupEventType, groupEventTypeFor } from "../../models/committee.model";
import { Confirm } from "../../models/ui-actions";
import { ValueOrDefaultPipe } from "../../pipes/value-or-default.pipe";
import { CommitteeConfigService } from "../../services/committee/commitee-config.service";
import { CommitteeFileService } from "../../services/committee/committee-file.service";
import { CommitteeReferenceData } from "../../services/committee/committee-reference-data";
import { ContentMetadataService } from "../../services/content-metadata.service";
import { DateUtilsService } from "../../services/date-utils.service";
import { Logger, LoggerFactory } from "../../services/logger-factory.service";
import { MemberLoginService } from "../../services/member/member-login.service";
import { AlertInstance } from "../../services/notifier.service";
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
  private valueOrDefault = inject(ValueOrDefaultPipe);
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

  fileUrl(committeeFile: CommitteeFile) {
    return committeeFile ? this.urlService.baseUrl() + "/" + this.committeeFileBaseUrl + "/" + committeeFile?.fileNameData?.awsFileName : "";
  }

  fileTitle(committeeFile: CommitteeFile) {
    const title = this.valueOrDefault.transform(committeeFile?.fileNameData?.title, committeeFile?.fileNameData?.originalFileName, "");
    const delimiter = title ? ` - ` : "";
    return committeeFile ? `${this.dateUtils.asString(committeeFile?.eventDate, undefined, this.dateUtils.formats.displayDateTh)}${delimiter}${title}` : "";
  }

  fileExtensionIs(fileName, extensions: string[]) {
    return extensions.includes(this.fileExtension(fileName));
  }

  fileExtension(fileName: string) {
    return fileName ? last(fileName.split(".")).toLowerCase() : "";
  }

  iconFile(committeeFile: CommitteeFile): string {
    if (this.fileExtensionIs(committeeFile?.fileNameData?.awsFileName, ["doc", "docx", "jpg", "pdf", "ppt", "png", "txt", "xls", "xlsx"])) {
      return "icon-" + this.fileExtension(committeeFile?.fileNameData?.awsFileName).substring(0, 3) + ".jpg";
    } else {
      return "icon-default.jpg";
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

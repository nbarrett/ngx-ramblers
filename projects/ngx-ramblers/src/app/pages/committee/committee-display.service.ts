import { Injectable } from "@angular/core";
import cloneDeep from "lodash-es/cloneDeep";
import last from "lodash-es/last";
import { ModalOptions } from "ngx-bootstrap/modal";
import { NgxLoggerLevel } from "ngx-logger";
import { Observable } from "rxjs";
import { CommitteeFile } from "../../models/committee.model";
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

@Injectable({
  providedIn: "root"
})

export class CommitteeDisplayService {
  private logger: Logger;
  public committeeFileBaseUrl = this.contentMetadataService.baseUrl("committeeFiles");
  public committeeReferenceData: CommitteeReferenceData;
  public confirm: Confirm = new Confirm();

  constructor(
    private memberLoginService: MemberLoginService,
    public urlService: UrlService,
    private valueOrDefault: ValueOrDefaultPipe,
    private dateUtils: DateUtilsService,
    private committeeFileService: CommitteeFileService,
    private contentMetadataService: ContentMetadataService,
    private committeeConfig: CommitteeConfigService,
    loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(CommitteeDisplayService, NgxLoggerLevel.OFF);
    this.committeeConfig.events().subscribe(data => this.committeeReferenceData = data);
    this.logger.debug("this.memberLoginService", this.memberLoginService.loggedInMember());
  }

  configEvents(): Observable<CommitteeReferenceData> {
    return this.committeeConfig.events();
  }

  defaultCommitteeFile(): CommitteeFile {
    return cloneDeep({
      createdDate: this.dateUtils.momentNow().valueOf(),
      eventDate: this.dateUtils.momentNowNoTime().valueOf(),
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

}

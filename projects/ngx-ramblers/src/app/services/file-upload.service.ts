import { HttpClient, HttpErrorResponse } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import isUndefined from "lodash-es/isUndefined";
import { FileUploader } from "ng2-file-upload";
import { NgxLoggerLevel } from "ngx-logger";
import { AuthService } from "../auth/auth.service";
import { S3_BASE_URL } from "../models/content-metadata.model";
import { CommonDataService } from "./common-data-service";
import { DateUtilsService } from "./date-utils.service";
import { Logger, LoggerFactory } from "./logger-factory.service";
import { UrlService } from "./url.service";
import { FileUtilsService } from "../file-utils.service";
import { AwsFileUploadResponse, AwsFileUploadResponseData, AwsUploadErrorResponse } from "../models/aws-object.model";
import first from "lodash-es/first";
import { AlertInstance } from "./notifier.service";
import { StringUtilsService } from "./string-utils.service";
import { AlertMessage } from "../models/alert-target.model";

@Injectable({
  providedIn: "root"
})
export class FileUploadService {
  private logger: Logger = inject(LoggerFactory).createLogger("FileUploadService", NgxLoggerLevel.ERROR);
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  protected dateUtils = inject(DateUtilsService);
  private commonDataService = inject(CommonDataService);
  private stringUtils = inject(StringUtilsService);
  private fileUtilsService = inject(FileUtilsService);
  private urlService = inject(UrlService);
  private URL_TO_FILE_URL = "api/aws/url-to-file";

  createUploaderFor(rootFolder: string, autoUpload?: boolean): FileUploader {
    return new FileUploader({
      url: `${S3_BASE_URL}/file-upload?root-folder=${rootFolder}`,
      disableMultipart: false,
      autoUpload: isUndefined(autoUpload) ? true : autoUpload,
      parametersBeforeFiles: true,
      additionalParameter: {},
      authTokenHeader: "Authorization",
      authToken: `Bearer ${this.authService.authToken()}`,
      formatDataFunctionIsAsync: false,
    });
  }

  public async urlToFile(localOrRemoteUrl: string, localFileName: string): Promise<File> {
    const blob = await this.requestLocalOrRemote(localOrRemoteUrl);
    const file = this.createImageFileFrom(blob, localFileName);
    this.logger.info("urlToFile received:blob", blob, "converted to file:", file);
    return file;
  }

  public createImageFileFrom(blob: Blob, fileName: string) {
    return new File([blob], fileName, {type: "image/jpeg"});
  }

  private requestLocalOrRemote(url: string): Promise<Blob> {
    if (this.urlService.isRemoteUrl(url)) {
      return this.remoteUrlToBlob(url);
    } else {
      return this.fileUtilsService.localUrlToBlob(url);
    }
  }

  async remoteUrlToBlob(url: string): Promise<Blob> {
    const relativeUrl = this.urlService.removeS3PrefixFrom(url);
    const params = this.commonDataService.toHttpParams({url: relativeUrl});
    const apiResponse = await this.http.get(this.URL_TO_FILE_URL, {params, responseType: "blob"}).toPromise();
    this.logger.debug("relativeUrl", relativeUrl, "- received", apiResponse);
    return apiResponse;
  }

  handleAwsFileUploadResponse(response: string | HttpErrorResponse, notify: AlertInstance, logger: Logger): AwsFileUploadResponse {
    this.logger.debug("response", response, "type", typeof response);
    notify.clearBusy();
    const uploadResponse: AwsFileUploadResponse = this.validateAndParse(response, logger, notify);
    const responses: AwsFileUploadResponseData[] = uploadResponse.responses;
    const errors: AwsUploadErrorResponse[] = uploadResponse.errors;
    if (responses.length > 0) {
      notify.clearBusy();
      logger.debug("JSON response:", uploadResponse);
      return uploadResponse;
    } else if (errors.length > 0) {
      notify.error({title: "File upload failed", message: errors});
    }
  }

  handleSingleResponseDataItem(response: string | HttpErrorResponse, notify: AlertInstance, logger: Logger): AwsFileUploadResponseData {
    this.logger.debug("response", response, "type", typeof response);
    notify.clearBusy();
    const uploadResponse: AwsFileUploadResponse = this.validateAndParse(response, logger, notify);
    const responses: AwsFileUploadResponseData[] = uploadResponse.responses;
    const errors: AwsUploadErrorResponse[] = uploadResponse.errors;
    if (responses.length > 0) {
      const firstResponse: AwsFileUploadResponseData = first(responses);
      if (responses.length === 1) {
        notify.success({
          title: "File upload success",
          message: `${this.stringUtils.pluraliseWithCount(responses.length, "file")} ${this.stringUtils.pluraliseWithCount(responses.length, "was", "were")} uploaded`
        });
      } else if (responses.length > 1) {
        notify.warning({
          title: "More than one file uploaded",
          message: `${this.stringUtils.pluraliseWithCount(responses.length, "file")} ${this.stringUtils.pluraliseWithCount(responses.length, "was", "were")} uploaded but only the first will be processed`
        });
      }
      notify.clearBusy();
      logger.info("JSON response:", uploadResponse, "firstResponse:", firstResponse);
      return firstResponse;
    } else if (errors.length > 0) {
      notify.error({title: "File upload failed", message: errors});
    }
  }

  private validateAndParse(response: string | HttpErrorResponse, logger: Logger, notify: AlertInstance): AwsFileUploadResponse {
    if (response instanceof HttpErrorResponse) {
      this.throwOrNotifyError({
        title: "Upload failed",
        message: response.error
      }, logger, notify);
    } else if (response === "Unauthorized") {
      this.throwOrNotifyError({
        title: "Upload failed",
        message: response + " - try logging out and logging back in again and trying this again."
      }, logger, notify);
    } else {
      return JSON.parse(response);
    }
  }


  private throwOrNotifyError(message: AlertMessage, logger: Logger, notify: AlertInstance) {
    logger.error(message);
    notify.error(message);
  }
}

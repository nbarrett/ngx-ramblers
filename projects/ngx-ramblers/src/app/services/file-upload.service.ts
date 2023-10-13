import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import isUndefined from "lodash-es/isUndefined";
import { FileUploader } from "ng2-file-upload";
import { NgxLoggerLevel } from "ngx-logger";
import { AuthService } from "../auth/auth.service";
import { S3_BASE_URL } from "../models/content-metadata.model";
import { CommonDataService } from "./common-data-service";
import { ContentMetadataService } from "./content-metadata.service";
import { DateUtilsService } from "./date-utils.service";
import { Logger, LoggerFactory } from "./logger-factory.service";
import { UrlService } from "./url.service";

@Injectable({
  providedIn: "root"
})
export class FileUploadService {

  private logger: Logger;
  private URL_TO_FILE_URL = "api/aws/url-to-file";

  constructor(private http: HttpClient,
              private authService: AuthService, protected dateUtils: DateUtilsService,
              private commonDataService: CommonDataService,
              private contentMetadataService: ContentMetadataService,
              private urlService: UrlService,
              loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(FileUploadService, NgxLoggerLevel.OFF);
  }

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
      return this.localUrlToBlob(url);
    }
  }

  public async loadBase64Image(url: string): Promise<string> {
    const blob = await this.localUrlToBlob(url);
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = () => {
        const base64data = reader.result;
        resolve(base64data as string);
      };
    });
  }

  async remoteUrlToBlob(url: string): Promise<Blob> {
    const relativeUrl = this.urlService.removeS3PrefixFrom(url);
    const params = this.commonDataService.toHttpParams({url: relativeUrl});
    const apiResponse = await this.http.get(this.URL_TO_FILE_URL, {params, responseType: "blob"}).toPromise();
    this.logger.debug("relativeUrl", relativeUrl, "- received", apiResponse);
    return apiResponse;
  }

  private async localUrlToBlob(url: string): Promise<Blob> {
    const urlPath = this.urlService.resourceRelativePathForAWSFileName(url);
    const blob = await (await fetch(urlPath)).blob();
    this.logger.info("localUrlToBlob:url:", url, "urlPath:", urlPath, "blob:", blob);
    return blob;
  }

}

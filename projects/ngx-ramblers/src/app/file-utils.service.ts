import { Injectable } from "@angular/core";
import first from "lodash-es/first";
import isEmpty from "lodash-es/isEmpty";
import last from "lodash-es/last";
import { NgxLoggerLevel } from "ngx-logger";
import { DateUtilsService } from "./services/date-utils.service";
import { Logger, LoggerFactory } from "./services/logger-factory.service";
import { UrlService } from "./services/url.service";
import {
  Base64File,
  ContentMetadataItem,
  FileTypeAttributes,
  fileTypeAttributes
} from "./models/content-metadata.model";
import { AwsFileData } from "./models/aws-object.model";
import { base64ToFile } from "ngx-image-cropper";

@Injectable({
  providedIn: "root"
})
export class FileUtilsService {
  private logger: Logger;

  constructor(protected dateUtils: DateUtilsService,
              private urlService: UrlService,
              loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(FileUtilsService, NgxLoggerLevel.OFF);
  }

  base64ToFileWithName(data, filename) {
    const arr = data.split(",");
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);

    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }

    return new File([u8arr], filename, {type: mime});
  }

  async localUrlToBlob(url: string): Promise<Blob> {
    const urlPath = this.urlService.resourceRelativePathForAWSFileName(url);
    const blob = await (await fetch(urlPath)).blob();
    this.logger.info("localUrlToBlob:url:", url, "urlPath:", urlPath, "blob:", blob);
    return blob;
  }

  public async loadBase64ImageFromUrl(url: string): Promise<string> {
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

  public async fileListToBase64Files(fileList: any): Promise<Base64File[]> {
    const files: File[] = Array.from(fileList as FileList);
    this.logger.info("fileList:", fileList);
    const base64Files = await Promise.all(files.map(file => {
      this.logger.info("file:", file);
      return this.loadBase64ImageFromFile(file);
    }));
    this.logger.info("processed:", base64Files);
    return base64Files;
  }

  public async loadBase64ImageFromFile(file: File): Promise<Base64File> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64File: Base64File = {file, base64Content: reader.result as string};
        this.logger.info("loadBase64ImageFromFile:", file, "base64File:", base64File);
        resolve(base64File);
      };
      reader.onerror = (error: ProgressEvent<FileReader>) => {
        reject(error);
      };
    });
  }

  public contentMetadataItemFromBase64File(base64File: Base64File): ContentMetadataItem {
    return {
      eventId: null,
      dateSource: "upload",
      date: this.dateUtils.asMoment(base64File.file.lastModified).valueOf(),
      base64Content: base64File.base64Content,
      originalFileName: base64File.file.name,
      tags: []
    };
  }

  public awsFileData(awsFileName: string, image: string, originalFile: File): AwsFileData {
    return {
      awsFileName,
      image,
      file: new File([base64ToFile(image)], originalFile?.name, {lastModified: originalFile?.lastModified, type: originalFile?.type})
    };
  }

  basename(path:string) {
    return path?.split(/[\\/]/)?.pop();
  }

  fileNameNoExtension(path): string {
    const basename = this.basename(path);
    const fileNameNoExtension: string = first(basename.split("."));
    this.logger.debug("fileNameNoExtension:path", path, "basename:", basename, "returning:", fileNameNoExtension);
    return fileNameNoExtension;
  }

  path(path) {
    return path.split(this.basename(path))[0];
  }

  attachmentTitle(resource, container, resourceName) {
    return (resource && isEmpty(this.getFileNameData(resource, container)) ? "Attach" : "Replace") + " " + resourceName;
  }

  getFileNameData(resource, container) {
    return container ? resource[container].fileNameData : resource.fileNameData;
  }

  fileExtensionIs(fileName: string, extensions: string[]): boolean {
    return extensions.includes(this.fileExtension(fileName));
  }

  fileExtension(fileName: string): string {
    return fileName ? last(fileName.split(".")).toLowerCase() : "";
  }

  icon(resource, container) {
    let icon = "icon-default.jpg";
    const fileNameData = this.getFileNameData(resource, container);
    if (fileNameData && this.fileExtensionIs(fileNameData.awsFileName, ["doc", "docx", "jpg", "pdf", "ppt", "png", "txt", "xls", "xlsx"])) {
      icon = "icon-" + this.fileExtension(fileNameData.awsFileName).substring(0, 3) + ".jpg";
    }
    return "images/ramblers/" + icon;
  }

  fileTypeAttributesForName(name: string): FileTypeAttributes {
    const fileExtension = this.fileExtension(name);
    return fileTypeAttributes.find(fileTypeAttributes => fileTypeAttributes.fileExtensions.includes(fileExtension));
  }

  fileTypeAttributesForFile(file: File): FileTypeAttributes {
    return fileTypeAttributes.find(fileTypeAttributes => fileTypeAttributes.contentType === file.type);
  }
}

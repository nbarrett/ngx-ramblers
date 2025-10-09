import { inject, Injectable } from "@angular/core";
import { first, isEmpty, last } from "es-toolkit/compat";
import { NgxLoggerLevel } from "ngx-logger";
import { DateUtilsService } from "./services/date-utils.service";
import { Logger, LoggerFactory } from "./services/logger-factory.service";
import { UrlService } from "./services/url.service";
import {
  Base64File,
  CheckedImage,
  ContentMetadataItem,
  FileTypeAttributes,
  fileTypeAttributes,
  IMAGE_JPEG
} from "./models/content-metadata.model";
import { AwsFileData } from "./models/aws-object.model";
import { base64ToFile } from "ngx-image-cropper";
import heic2any from "heic2any";
import { basename } from "./functions/file-utils";
import { StringUtilsService } from "./services/string-utils.service";

@Injectable({
  providedIn: "root"
})
export class FileUtilsService {

  private logger: Logger = inject(LoggerFactory).createLogger("FileUtilsService", NgxLoggerLevel.ERROR);
  protected dateUtils = inject(DateUtilsService);
  private urlService = inject(UrlService);
  private stringUtils = inject(StringUtilsService);

  public async convertHEICFile(file: Base64File): Promise<CheckedImage> {
    try {
      this.logger.info("heic file detected:", file.file, "attempting conversion to jpeg");
      const convertedBlob = await heic2any({blob: file.file, toType: IMAGE_JPEG});
      const reader = new FileReader();
      reader.readAsDataURL(convertedBlob as Blob);
      return new Promise<CheckedImage>((resolve) => {
        reader.onloadend = () => {
          const base64Content: string = reader.result as string;
          const newFile = this.applyBase64ToFile(base64Content, file.file, file.file.name.toLowerCase().replace(".heic", ".jpeg"), IMAGE_JPEG);
          const convertedBase64File = {
            file: newFile,
            base64Content
          };
          this.logger.info("heic file conversion complete:", convertedBase64File);
          resolve({file: convertedBase64File, isImage: true});
        };
      });
    } catch (error) {
      this.logger.error("Error converting heic file:", error);
      return {file, isImage: false};
    }
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

    const name = filename ? filename : this.defaultPastedFilename(mime);

    return new File([u8arr], name, {type: mime});
  }

  private defaultPastedFilename(mime: string): string {
    const ext = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : mime.includes("gif") ? "gif" : "jpeg";
    const stamped = this.dateUtils.displayDateAndTime(this.dateUtils.dateTimeNow());
    return `${stamped} pasted content.${ext}`;
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
      date: this.dateUtils.asDateTime(base64File.file.lastModified).toMillis(),
      base64Content: base64File.base64Content,
      originalFileName: base64File.file.name,
      tags: []
    };
  }

  public awsFileData(awsFileName: string, image: string, originalFile: File): AwsFileData {
    return {
      awsFileName,
      image,
      file: this.applyBase64ToFile(image, originalFile, awsFileName)
    };
  }

  public applyBase64ToFile(base64Image: string, originalFile: File, renamedFile?: string, newType?: string): File {
    const type = newType || originalFile?.type;
    this.logger.info("applyBase64ToFile:base64Image:", this.stringUtils.truncate(base64Image, 50), "originalFile:", originalFile, "renamedFile:", this.stringUtils.truncate(renamedFile, 50), "type:", type);
    return new File([base64ToFile(base64Image)], renamedFile || originalFile?.name, {
      lastModified: originalFile?.lastModified,
      type
    });
  }

  basename(path:string) {
    return basename(path);
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

  altFrom(alt: string, url: string): string {
    const source = this.fileNameNoExtension(url);
    return (alt || source || "Image");
  }

}

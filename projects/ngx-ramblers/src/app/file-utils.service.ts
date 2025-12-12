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
} from "./models/content-metadata.model";
import { AwsFileData } from "./models/aws-object.model";
import { base64ToFile } from "ngx-image-cropper";
import heic2any from "heic2any";
import { basename } from "./functions/file-utils";
import { StringUtilsService } from "./services/string-utils.service";
import { IMAGE_JPEG, IMAGE_PNG, IMAGE_SVG } from "./models/content-metadata.model";

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

  public isResizableName(name: string): boolean {
    const attrs = this.fileTypeAttributesForName(name || "");
    return !!attrs && attrs.contentType !== IMAGE_SVG;
  }

  public async resizeBase64Image(base64Content: string, fileName: string, maxBytes: number, maxWidth = 1200): Promise<string | null> {
    try {
      const contentType = this.fileTypeAttributesForName(fileName)?.contentType || IMAGE_JPEG;
      const initialFile = new File([base64ToFile(base64Content)], fileName, {type: contentType});
      if (initialFile.size <= maxBytes) {
        return null;
      }
      const img = await this.loadImageFromBase64(base64Content);
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      const maxEnlargeWidth = Math.min(img.width, 4096);
      const setCanvasSize = (w: number) => {
        const width = Math.max(1, Math.min(w, maxEnlargeWidth));
        const height = Math.round(img.height * (width / img.width));
        canvas.width = width;
        canvas.height = height;
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
      };
      const initialWidth = Math.min(img.width, maxWidth || img.width);
      setCanvasSize(initialWidth);
      const hasAlpha = () => {
        const sampleW = Math.min(canvas.width, 64);
        const sampleH = Math.min(canvas.height, 64);
        const data = ctx.getImageData(0, 0, sampleW, sampleH).data;
        for (let i = 3; i < data.length; i += 4) {
          if (data[i] !== 255) return true;
        }
        return false;
      };

      const targetBytes = Math.max(1, maxBytes);
      const targetChars = Math.floor(targetBytes * 0.98); // align with UI which counts base64 chars; add small safety margin
      const encodeAt = async (type: string, q: number): Promise<{data: string; size: number}> => {
        const data = await new Promise<string>((resolve) => canvas.toBlob(async blob => {
          const b = blob as Blob;
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(b);
        }, type, q));
        const size = data.length; // compare using base64 length to match UI display
        return { data, size };
      };

      const growToTarget = async (type: string): Promise<{data: string; size: number}> => {
        let probe = await encodeAt(type, 1.0);
        if (probe.size < targetChars * 0.9) {
          let width = canvas.width;
          for (let i = 0; i < 8 && width < maxEnlargeWidth; i++) {
            const grow = Math.max(1.1, Math.min(2.0, Math.sqrt(targetChars / Math.max(1, probe.size))));
            const nextWidth = Math.min(Math.round(width * grow), maxEnlargeWidth);
            if (nextWidth <= width) break;
            width = nextWidth;
            setCanvasSize(width);
            probe = await encodeAt(type, 1.0);
            if (probe.size >= targetChars * 0.9) break;
          }
        }
        return probe;
      };

      const preferWebp = contentType === IMAGE_PNG || hasAlpha();
      const primaryType = preferWebp ? "image/webp" : IMAGE_JPEG;
      const secondaryType = preferWebp ? IMAGE_JPEG : "image/webp";

      const primaryHi = await growToTarget(primaryType);
      let chosenType = primaryType;
      let chosenHi = primaryHi;
      if (chosenHi.size < targetChars * 0.8 && !hasAlpha()) {
        const altHi = await growToTarget(secondaryType);
        if (altHi.size > chosenHi.size && altHi.size <= targetChars) {
          chosenType = secondaryType;
          chosenHi = altHi;
        }
      }

      const tuneQuality = async (type: string, hiProbe: {data: string; size: number}) => {
        let lowQ = 0.05;
        let highQ = 1.0;
        let best: {data: string; size: number} | null = hiProbe.size <= targetChars ? hiProbe : null;
        for (let i = 0; i < 12; i++) {
          const mid = (lowQ + highQ) / 2;
          const cand = await encodeAt(type, mid);
          if (cand.size <= targetChars) {
            best = cand;
            lowQ = mid + 0.01;
          } else {
            highQ = mid - 0.01;
          }
        }
        if (best) return best;
        return await encodeAt(type, lowQ);
      };

      const final = await tuneQuality(chosenType, chosenHi);
      return final.data;
    } catch (e) {
      this.logger.error("resizeBase64Image error", e);
      return null;
    }
  }

  private loadImageFromBase64(base64Content: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = (err) => reject(err);
      img.src = base64Content;
    });
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

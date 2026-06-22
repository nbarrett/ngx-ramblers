import { inject, Injectable } from "@angular/core";
import { chunk, first, isEmpty, last } from "es-toolkit/compat";
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

  private static readonly FILE_READ_CONCURRENCY = 6;
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

  public async downscaleBase64Image(base64Content: string, fileName: string, maxWidth: number, quality = 0.92): Promise<string | null> {
    try {
      const img = await this.loadImageFromBase64(base64Content);
      if (!(maxWidth > 0) || img.width <= maxWidth) {
        return null;
      }
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        return null;
      }
      const width = maxWidth;
      const height = Math.round(img.height * (width / img.width));
      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);
      const contentType = this.fileTypeAttributesForName(fileName)?.contentType || IMAGE_JPEG;
      const outputType = contentType === IMAGE_PNG ? "image/webp" : IMAGE_JPEG;
      return await new Promise<string>((resolve) => canvas.toBlob(blob => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob as Blob);
      }, outputType, quality));
    } catch (e) {
      this.logger.error("downscaleBase64Image error", e);
      return null;
    }
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
        return Array.from({length: Math.floor(data.length / 4)}, (_, i) => data[i * 4 + 3]).some(alpha => alpha !== 255);
      };

      const targetBytes = Math.max(1, maxBytes);
      const base64CharsPerByte = 4 / 3;
      const base64BudgetFromBytes = (bytes: number) => Math.floor(bytes * base64CharsPerByte * 0.98);
      const targetChars = base64BudgetFromBytes(targetBytes);
      const encodeAt = async (type: string, q: number): Promise<{data: string; size: number}> => {
        const data = await new Promise<string>((resolve) => canvas.toBlob(async blob => {
          const b = blob as Blob;
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(b);
        }, type, q));
        return { data, size: data.length };
      };

      const growToTarget = async (type: string): Promise<{data: string; size: number}> => {
        let probe = await encodeAt(type, 1.0);
        if (probe.size < targetChars * 0.9) {
          const result = await Array.from({length: 8}).reduce<Promise<{probe: {data: string; size: number}; width: number; done: boolean}>>(async (accPromise, _) => {
            const acc = await accPromise;
            if (acc.done || acc.width >= maxEnlargeWidth) return acc;
            const grow = Math.max(1.1, Math.min(2.0, Math.sqrt(targetChars / Math.max(1, acc.probe.size))));
            const nextWidth = Math.min(Math.round(acc.width * grow), maxEnlargeWidth);
            if (nextWidth <= acc.width) return {...acc, done: true};
            setCanvasSize(nextWidth);
            const nextProbe = await encodeAt(type, 1.0);
            return {probe: nextProbe, width: nextWidth, done: nextProbe.size >= targetChars * 0.9};
          }, Promise.resolve({probe, width: canvas.width, done: false}));
          probe = result.probe;
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
        const initial = {lowQ: 0.05, highQ: 1.0, best: hiProbe.size <= targetChars ? hiProbe : null as typeof hiProbe | null};
        const result = await Array.from({length: 12}).reduce<Promise<typeof initial>>(async (accPromise, _) => {
          const acc = await accPromise;
          const mid = (acc.lowQ + acc.highQ) / 2;
          const cand = await encodeAt(type, mid);
          if (cand.size <= targetChars) {
            return {lowQ: mid + 0.01, highQ: acc.highQ, best: cand};
          } else {
            return {lowQ: acc.lowQ, highQ: mid - 0.01, best: acc.best};
          }
        }, Promise.resolve(initial));
        if (result.best) return result.best;
        return await encodeAt(type, result.lowQ);
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
    const u8arr = new Uint8Array(Array.from({length: bstr.length}, (_, i) => bstr.charCodeAt(i)));
    const name = filename ? filename : this.pastedFilenameForMime(mime);

    return new File([u8arr], name, {type: mime});
  }

  public pastedFilenameForMime(mime: string): string {
    const ext = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : mime.includes("gif") ? "gif" : "jpeg";
    const stamped = this.dateUtils.displayDateAndTime(this.dateUtils.dateTimeNow());
    return `${this.stringUtils.kebabCase(stamped, "pasted content")}.${ext}`;
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
    this.logger.info("fileListToBase64Files:", files.length, "files");
    const loaded: Base64File[] = [];
    const failures: string[] = [];
    for (const batch of chunk(files, FileUtilsService.FILE_READ_CONCURRENCY)) {
      const outcomes = await Promise.all(batch.map(file => this.readFileOrNull(file)));
      outcomes.forEach((base64File, index) => {
        if (base64File) {
          loaded.push(base64File);
        } else {
          failures.push(batch[index]?.name || "unknown file");
        }
      });
    }
    if (failures.length > 0) {
      this.logger.warn(`fileListToBase64Files: ${failures.length} of ${files.length} files could not be read:`, failures);
    }
    this.logger.info("fileListToBase64Files: loaded", loaded.length, "of", files.length, "files");
    return loaded;
  }

  private async readFileOrNull(file: File): Promise<Base64File | null> {
    try {
      return await this.loadBase64ImageFromFile(file);
    } catch (error) {
      this.logger.warn("fileListToBase64Files: could not read", file?.name, error);
      return null;
    }
  }

  public async loadBase64ImageFromFile(file: File): Promise<Base64File> {
    try {
      return await this.readFileAsBase64(file);
    } catch (firstError) {
      this.logger.warn("loadBase64ImageFromFile: retrying read for", file?.name, "after error:", firstError);
      await new Promise(resolve => setTimeout(resolve, 150));
      return this.readFileAsBase64(file);
    }
  }

  private readFileAsBase64(file: File): Promise<Base64File> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve({file, base64Content: reader.result as string});
      reader.onerror = () => reject(reader.error || new Error(`Could not read file ${file?.name}`));
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

  basename(path: string) {
    return path ? basename(path) : "";
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
    return fileTypeAttributes.find(fileTypeAttributes => fileTypeAttributes.contentType === file?.type)
      ?? (file?.name ? this.fileTypeAttributesForName(file.name) : undefined);
  }

  altFrom(alt: string, url: string): string {
    const source = this.fileNameNoExtension(url);
    return (alt || source || "Image");
  }

}

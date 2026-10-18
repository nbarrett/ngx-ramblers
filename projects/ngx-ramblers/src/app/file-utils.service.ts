import { firstValueFrom, from, timeout } from "rxjs";
import { inject, Injectable } from "@angular/core";
import { chunk, first, isEmpty, last } from "es-toolkit/compat";
import { NgxLoggerLevel } from "ngx-logger";
import { DateUtilsService } from "./services/date-utils.service";
import { Logger, LoggerFactory } from "./services/logger-factory.service";
import { UrlService } from "./services/url.service";
import {
  Base64File,
  CheckedImage,
  PreparedDroppedImages,
  ContentMetadataItem,
  FileType,
  FileTypeAttributes,
  fileTypeAttributes,
} from "./models/content-metadata.model";
import { AwsFileData } from "./models/aws-object.model";
import { base64ToFile } from "ngx-image-cropper";
import { ImageDuplicatesService } from "./services/image-duplicates-service";
import { heicToJpeg } from "./functions/heic-conversion";
import { basename } from "./functions/file-utils";
import { StringUtilsService } from "./services/string-utils.service";
import { IMAGE_JPEG, IMAGE_PNG, IMAGE_SVG } from "./models/content-metadata.model";

@Injectable({
  providedIn: "root"
})
export class FileUtilsService {

  private static readonly FILE_READ_CONCURRENCY = 6;
  private static readonly IMAGE_OPERATION_TIMEOUT_MS = 30000;
  private logger: Logger = inject(LoggerFactory).createLogger("FileUtilsService", NgxLoggerLevel.ERROR);
  protected dateUtils = inject(DateUtilsService);
  private urlService = inject(UrlService);
  private stringUtils = inject(StringUtilsService);
  private imageDuplicatesService = inject(ImageDuplicatesService);

  public isHeicFile(file: File | null): boolean {
    const type = (file?.type || "").toLowerCase();
    return this.fileTypeAttributesForFile(file)?.key === FileType.HEIC
      || type === "image/heic"
      || type === "image/heif"
      || /\.hei[cf]$/i.test(file?.name || "");
  }

  public async convertHEICFile(file: Base64File): Promise<CheckedImage> {
    try {
      this.logger.info("heic file detected:", file.file, "attempting conversion to jpeg");
      const convertedBlob = await heicToJpeg(file.file);
      const jpegName = /\.hei[cf]$/i.test(file.file.name)
        ? file.file.name.replace(/\.hei[cf]$/i, ".jpeg")
        : `${file.file.name || "photo"}.jpeg`;
      const convertedFile = new File([convertedBlob], jpegName, {type: IMAGE_JPEG, lastModified: file.file.lastModified});
      return {file: {...await this.loadBase64ImageFromFile(convertedFile), sourceChecksum: file.sourceChecksum, dateTaken: file.dateTaken}, isImage: true};
    } catch (error) {
      if (await this.canDisplayImage(file.base64Content)) {
        return {file, isImage: true};
      } else {
        this.logger.warn("HEIC photo could not be opened", file.file.name, error);
        return {file, isImage: false};
      }
    }
  }

  public async checkedImageFromBase64File(file: Base64File): Promise<CheckedImage> {
    if (this.isHeicFile(file.file)) {
      return this.convertHEICFile(file);
    } else if (!this.urlService.isBase64Image(file.base64Content)) {
      return {file, isImage: false};
    } else if (await this.canDisplayImage(file.base64Content)) {
      return {file, isImage: true};
    } else {
      return this.convertHEICFile(file);
    }
  }

  private async canDisplayImage(base64Content: string): Promise<boolean> {
    try {
      const image = await this.loadImageFromBase64(base64Content);
      image.src = "";
      return true;
    } catch {
      return false;
    }
  }

  public async prepareDroppedFiles(fileList: FileList | File[], existingFiles: ContentMetadataItem[] = []): Promise<PreparedDroppedImages> {
    const files: File[] = Array.from(fileList || []);
    const allBase64Files: Base64File[] = await this.fileListToBase64Files(files);
    const unread = Math.max(0, files.length - allBase64Files.length);
    const unique = await this.imageDuplicatesService.uniqueFilesFrom(allBase64Files, existingFiles);
    const checkedResults: CheckedImage[] = [];
    for (const file of unique.files) {
      const datedFile = {...file, dateTaken: await this.photoDateTaken(file.file)};
      checkedResults.push(await this.checkedImageFromBase64File(datedFile));
    }
    const images = checkedResults.filter(result => result.isImage).map(result => result.file);
    const skippedHeicFiles = checkedResults.filter(result => !result.isImage && this.isHeicFile(result.file.file)).map(result => result.file.file.name);
    const skippedHeic = skippedHeicFiles.length;
    const readFiles = new Set(allBase64Files.map(item => item.file));
    const failedFiles = [
      ...files.filter(file => !readFiles.has(file)).map(file => file.name),
      ...checkedResults.filter(result => !result.isImage).map(result => result.file.file.name)
    ];
    return {images, failedFiles, skippedHeic, skippedHeicFiles, unread, skippedDuplicates: unique.skippedDuplicates};
  }

  private async photoDateTaken(file: File): Promise<number | null> {
    try {
      const {parse} = await import("exifr");
      const metadata = await parse(file, ["DateTimeOriginal", "CreateDate"]);
      const date = metadata?.DateTimeOriginal || metadata?.CreateDate;
      return date instanceof Date && Number.isFinite(date.getTime()) ? date.getTime() : null;
    } catch (error) {
      this.logger.debug("No capture date found in photo metadata", file.name, error);
      return null;
    }
  }

  public isResizableName(name: string): boolean {
    const attrs = this.fileTypeAttributesForName(name || "");
    return !!attrs && attrs.contentType !== IMAGE_SVG;
  }

  public async downscaleBase64Image(base64Content: string, fileName: string, maxWidth: number, quality = 0.92): Promise<string | null> {
    const canvas = document.createElement("canvas");
    const img = await this.loadImageFromBase64(base64Content).catch(error => {
      this.logger.warn("downscaleBase64Image: leaving original pixels for", fileName, error);
      return null;
    });
    try {
      if (img && maxWidth > 0 && img.width > maxWidth) {
        canvas.width = maxWidth;
        canvas.height = Math.max(1, Math.round(img.height * (maxWidth / img.width)));
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          throw new Error(`Could not prepare ${fileName}. Try adding fewer photos at once.`);
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const contentType = this.fileTypeAttributesForName(fileName)?.contentType || IMAGE_JPEG;
        return await this.canvasToBase64(canvas, contentType === IMAGE_PNG ? "image/webp" : IMAGE_JPEG, quality);
      } else {
        return null;
      }
    } finally {
      canvas.width = 0;
      canvas.height = 0;
      if (img) {
        img.src = "";
      }
    }
  }

  public async resizeBase64Image(base64Content: string, fileName: string, maxBytes: number, maxWidth = 1200): Promise<string | null> {
    const canvas = document.createElement("canvas");
    const image = {element: null as HTMLImageElement | null};
    try {
      const contentType = this.fileTypeAttributesForName(fileName)?.contentType || IMAGE_JPEG;
      const initialFile = new File([base64ToFile(base64Content)], fileName, {type: contentType});
      if (initialFile.size <= maxBytes) {
        return null;
      }
      const img = await this.loadImageFromBase64(base64Content);
      image.element = img;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        throw new Error(`Could not resize ${fileName}. Try adding fewer photos at once.`);
      }
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
        const data = await this.canvasToBase64(canvas, type, q);
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
      throw e;
    } finally {
      canvas.width = 0;
      canvas.height = 0;
      if (image.element) {
        image.element.src = "";
      }
    }
  }

  private async canvasToBase64(canvas: HTMLCanvasElement, contentType: string, quality: number): Promise<string> {
    const blob = await firstValueFrom(from(new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(result => {
        if (result) {
          resolve(result);
        } else {
          reject(new Error("The photo could not be resized. Your device may be short of memory. Try adding fewer photos at once."));
        }
      }, contentType, quality);
    })).pipe(timeout(FileUtilsService.IMAGE_OPERATION_TIMEOUT_MS)));
    return (await this.loadBase64ImageFromFile(new File([blob], "resized-photo", {type: blob.type}))).base64Content;
  }

  private async loadImageFromBase64(base64Content: string): Promise<HTMLImageElement> {
    const img = new Image();
    try {
      return await firstValueFrom(from(new Promise<HTMLImageElement>((resolve, reject) => {
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("The photo could not be opened for resizing. Try adding it again or choose a different photo."));
        img.src = base64Content;
      })).pipe(timeout(FileUtilsService.IMAGE_OPERATION_TIMEOUT_MS)));
    } catch (error) {
      img.src = "";
      throw error;
    } finally {
      img.onload = null;
      img.onerror = null;
    }
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

  private async readFileAsBase64(file: File): Promise<Base64File> {
    const reader = new FileReader();
    try {
      return await firstValueFrom(from(new Promise<Base64File>((resolve, reject) => {
        reader.onload = () => resolve({file, base64Content: reader.result as string});
        reader.onerror = () => reject(reader.error || new Error(`Could not read file ${file?.name}`));
        reader.onabort = () => reject(new Error(`Reading ${file?.name} was interrupted. Try adding it again.`));
        reader.readAsDataURL(file);
      })).pipe(timeout(FileUtilsService.IMAGE_OPERATION_TIMEOUT_MS)));
    } finally {
      reader.onload = null;
      reader.onerror = null;
      reader.onabort = null;
      if (reader.readyState === FileReader.LOADING) {
        reader.abort();
      }
    }
  }

  public contentMetadataItemFromBase64File(base64File: Base64File): ContentMetadataItem {
    return {
      eventId: null,
      dateSource: "upload",
      date: base64File.dateTaken || this.dateUtils.asDateTime(base64File.file.lastModified).toMillis(),
      base64Content: base64File.base64Content,
      originalFileName: base64File.file.name,
      sourceChecksum: base64File.sourceChecksum,
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
    const fileName = this.safeUploadFileName(renamedFile || originalFile?.name, type);
    this.logger.info("applyBase64ToFile:base64Image:", this.stringUtils.truncate(base64Image, 50), "originalFile:", originalFile, "renamedFile:", this.stringUtils.truncate(renamedFile, 50), "fileName:", fileName, "type:", type);
    return new File([base64ToFile(base64Image)], fileName, {
      lastModified: originalFile?.lastModified,
      type
    });
  }

  public safeUploadFileName(requestedName: string, mime: string): string {
    const isDataUrl = !!requestedName && (requestedName.startsWith("data:") || this.urlService.isBase64Image(requestedName));
    if (!requestedName || isDataUrl || requestedName.length > 255) {
      return this.pastedFilenameForMime(mime || IMAGE_JPEG);
    }
    return requestedName;
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

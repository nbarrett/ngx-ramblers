import { inject, Injectable } from "@angular/core";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "./logger-factory.service";
import { FileUtilsService } from "../file-utils.service";

@Injectable({
  providedIn: "root"
})

export class ClipboardService {

  private logger: Logger = inject(LoggerFactory).createLogger("ClipboardService", NgxLoggerLevel.ERROR);
  private fileUtils = inject(FileUtilsService);
  private lastCopiedText: string;

  private clipboardData(e: ClipboardEvent): DataTransfer {
    return e?.clipboardData || window["clipboardData"];
  }

  public async copyToClipboard(item: string): Promise<void> {
    if (item) {
      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(item);
          this.lastCopiedText = item;
          this.logger.info("copied using navigator.clipboard:", this.lastCopiedText);
        } else {
          const listener = (e: ClipboardEvent) => {
            const clipboard: DataTransfer = this.clipboardData(e);
            clipboard.setData("text", item);
            this.lastCopiedText = item;
            e.preventDefault();
            this.logger.info("copied using execCommand:", this.lastCopiedText);
          };

          document.addEventListener("copy", listener, false);
          document.execCommand("copy");
          document.removeEventListener("copy", listener, false);
        }
      } catch (err) {
        this.logger.error("failed to copy to clipboard:", err);
      }
    }
  }

  public clipboardText(): string {
    return this.lastCopiedText;
  }

  public async readFromClipboard(): Promise<string> {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        const text = await navigator.clipboard.readText();
        this.logger.info("read from clipboard using navigator.clipboard:", text?.substring(0, 100));
        return text;
      } else {
        this.logger.warn("clipboard read not available in non-secure context");
        return null;
      }
    } catch (err) {
      this.logger.error("failed to read from clipboard:", err);
      return null;
    }
  }

  public imageFileFromPasteEvent(event: ClipboardEvent): File | null {
    const items = event?.clipboardData?.items || [];
    const fileItem = Array.from(items).find(item => item.kind === "file" && item.type.startsWith("image/"));
    const file = fileItem?.getAsFile() || null;
    return this.namedClipboardImage(file);
  }

  public async imageFileFromClipboard(): Promise<File | null> {
    try {
      if (!navigator?.clipboard?.read || !window.isSecureContext) {
        this.logger.warn("clipboard image read not available");
        return null;
      }
      const clipboardItems = await navigator.clipboard.read();
      for (const clipboardItem of clipboardItems) {
        const imageType = clipboardItem.types.find(type => type.startsWith("image/"));
        if (imageType) {
          const blob = await clipboardItem.getType(imageType);
          return this.namedClipboardImage(new File([blob], this.fileUtils.pastedFilenameForMime(imageType), {type: imageType}));
        }
      }
      return null;
    } catch (err) {
      this.logger.error("failed to read image from clipboard:", err);
      return null;
    }
  }

  private namedClipboardImage(file: File | null): File | null {
    if (!file) {
      return null;
    }
    const normalisedName = (file.name || "").trim().toLowerCase();
    const needsGeneratedName = !normalisedName
      || /^image(\.[a-z0-9]+)?$/.test(normalisedName)
      || /^pasted-image(\.[a-z0-9]+)?$/.test(normalisedName);
    if (!needsGeneratedName) {
      return file;
    }
    return new File([file], this.fileUtils.pastedFilenameForMime(file.type), {
      type: file.type,
      lastModified: file.lastModified
    });
  }
}

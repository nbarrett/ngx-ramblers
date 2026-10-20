import { Component, ElementRef, EventEmitter, inject, Input, OnInit, Output, ViewChild } from "@angular/core";
import { coerceBooleanProperty } from "@angular/cdk/coercion";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faFileImport, faSpinner } from "@fortawesome/free-solid-svg-icons";
import { FileUploader, FileUploadModule } from "ng2-file-upload";
import { NgxLoggerLevel } from "ngx-logger";
import { AuthService } from "../../auth/auth.service";
import { nativeApiUrl } from "../../functions/native-walking";
import { Logger, LoggerFactory } from "../../services/logger-factory.service";

@Component({
  selector: "app-gpx-file-import",
  imports: [FontAwesomeModule, FileUploadModule],
  host: {
    class: "gpx-file-import"
  },
  template: `
    @if (showButton) {
      <button type="button" class="btn btn-quiet" [disabled]="disabled || busy" (click)="choose()">
        <fa-icon [icon]="busy ? faSpinner : faFileImport" [animation]="busy ? 'spin' : null" class="me-2"/>
        {{ busy ? "Importing…" : "Import GPX" }}
      </button>
    }
    <input #fileInput class="d-none" type="file" accept=".gpx,application/gpx+xml"
           ng2FileSelect [uploader]="uploader">
    @if (showDropZone) {
      <div ng2FileDrop [uploader]="uploader" class="drop-zone" [class.flex-grow-1]="true">
        Or drop a GPX here
      </div>
    }
  `
})
export class GpxFileImportComponent implements OnInit {
  private logger: Logger = inject(LoggerFactory).createLogger("GpxFileImportComponent", NgxLoggerLevel.ERROR);
  private authService = inject(AuthService);
  @ViewChild("fileInput") private fileInput!: ElementRef<HTMLInputElement>;
  @Input() disabled = false;
  showButton = true;
  showDropZone = true;
  @Input("showButton") set showButtonValue(value: boolean) {
    this.showButton = coerceBooleanProperty(value);
  }
  @Input("showDropZone") set showDropZoneValue(value: boolean) {
    this.showDropZone = coerceBooleanProperty(value);
  }
  @Output() imported = new EventEmitter<void>();
  @Output() failed = new EventEmitter<string>();
  busy = false;
  faFileImport = faFileImport;
  faSpinner = faSpinner;
  uploader = new FileUploader({
    url: nativeApiUrl("/api/database/walks/gpx/import"),
    itemAlias: "file",
    disableMultipart: false,
    autoUpload: true,
    authTokenHeader: "Authorization",
    authToken: `Bearer ${this.authService.authToken()}`
  });

  ngOnInit(): void {
    this.uploader.onBeforeUploadItem = item => {
      this.uploader.authToken = `Bearer ${this.authService.authToken()}`;
      this.busy = true;
      item.withCredentials = false;
    };
    this.uploader.onSuccessItem = () => {
      this.busy = false;
      this.uploader.clearQueue();
      this.imported.emit();
    };
    this.uploader.onErrorItem = (_item, response) => {
      this.busy = false;
      this.uploader.clearQueue();
      this.failed.emit(this.failureMessage(response));
    };
  }

  choose(): void {
    if (!this.disabled && !this.busy) {
      this.uploader.authToken = `Bearer ${this.authService.authToken()}`;
      this.fileInput?.nativeElement?.click();
    }
  }

  private failureMessage(response: string): string {
    try {
      const parsed = JSON.parse(response);
      return parsed?.message || parsed?.error || "The file could not be saved. Try again after signing in.";
    } catch (error) {
      this.logger.error("Could not parse GPX import failure", error);
      return response || "The file could not be saved. Try again after signing in.";
    }
  }
}

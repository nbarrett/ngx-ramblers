import { Component, EventEmitter, Output } from "@angular/core";

import { FormsModule } from "@angular/forms";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faCheck, faExclamationTriangle } from "@fortawesome/free-solid-svg-icons";
import { parseMongoUri } from "../../../functions/mongo";

export interface MongoUriParseResult {
  cluster: string;
  username: string;
  password: string;
  database?: string;
}

@Component({
  selector: "app-mongo-uri-input",
  imports: [FormsModule, FontAwesomeModule],
  template: `
    <div class="mb-2">
      <label class="form-label" for="mongo-connection-string">Connection string</label>
      <input [(ngModel)]="connectionString"
             type="text"
             class="form-control"
             id="mongo-connection-string"
             autocomplete="off"
             placeholder="mongodb+srv://user:password@cluster.mongodb.net/database"
             (paste)="onPaste($event)"
             (ngModelChange)="handleParse()">
      @if (parsed) {
        <div class="text-success small mt-1">
          <fa-icon [icon]="faCheck" class="me-1"></fa-icon>
          Parsed successfully
        </div>
      } @else if (connectionString && !parsed) {
        <div class="text-warning small mt-1">
          <fa-icon [icon]="faExclamationTriangle" class="me-1"></fa-icon>
          Could not parse URI
        </div>
      }
    </div>
  `
})
export class MongoUriInputComponent {
  @Output() parsedUri = new EventEmitter<MongoUriParseResult>();

  connectionString = "";
  parsed = false;

  protected readonly faCheck = faCheck;
  protected readonly faExclamationTriangle = faExclamationTriangle;

  onPaste(event: ClipboardEvent) {
    const pastedText = event.clipboardData?.getData("text");
    if (pastedText) {
      this.connectionString = pastedText;
      this.handleParse();
    }
  }

  handleParse() {
    this.parsed = false;
    if (!this.connectionString) {
      return;
    }

    const result = parseMongoUri(this.connectionString);
    if (result) {
      this.parsed = true;
      this.parsedUri.emit({
        cluster: result.cluster,
        username: result.username,
        password: result.password,
        ...(result.database ? { database: result.database } : {})
      });
    }
  }
}

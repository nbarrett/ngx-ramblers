import { Component, EventEmitter, Output } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faCheck, faExclamationTriangle } from "@fortawesome/free-solid-svg-icons";
import { MongoDbConnectionConfig, parseMongoUri } from "../../../functions/mongo";

export interface MongoUriParseResult extends MongoDbConnectionConfig {
  database: string;
}

@Component({
  selector: "app-mongo-uri-input",
  standalone: true,
  imports: [CommonModule, FormsModule, FontAwesomeModule],
  template: `
    <div class="row mb-2">
      <div class="col-md-8">
        <label for="mongo-connection-string">Connection String (paste full URI to auto-populate)</label>
        <input [(ngModel)]="connectionString"
               type="text"
               class="form-control"
               id="mongo-connection-string"
               placeholder="mongodb+srv://user:password@cluster.mongodb.net/database"
               (paste)="onPaste($event)"
               (ngModelChange)="handleParse()">
      </div>
      <div class="col-md-4 d-flex align-items-end">
        @if (parsed) {
          <span class="text-success mb-2">
            <fa-icon [icon]="faCheck" class="me-1"></fa-icon>
            Parsed successfully
          </span>
        } @else if (connectionString && !parsed) {
          <span class="text-warning mb-2">
            <fa-icon [icon]="faExclamationTriangle" class="me-1"></fa-icon>
            Could not parse URI
          </span>
        }
      </div>
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
        database: result.database
      });
    }
  }
}

import { Component, EventEmitter, inject, OnInit, Output } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faCircleExclamation } from "@fortawesome/free-solid-svg-icons";
import { OsMapsExportService } from "../../services/maps/os-maps-export.service";

@Component({
  selector: "app-os-maps-personal-account",
  imports: [FormsModule, FontAwesomeModule],
  template: `
    <details class="mb-3">
      <summary>My OS Maps account</summary>
      <p class="mt-2">Your login details are saved in your personal settings. Leave the password blank to keep the saved password.</p>
      <form class="d-flex flex-wrap align-items-end gap-2" (ngSubmit)="save()">
        <div>
          <label for="personal-os-email" class="form-label">OS Maps email</label>
          <input id="personal-os-email" name="email" type="email" class="form-control" autocomplete="username" [(ngModel)]="email" required/>
        </div>
        <div>
          <label for="personal-os-password" class="form-label">OS Maps password</label>
          <input id="personal-os-password" name="password" type="password" class="form-control" autocomplete="new-password" [(ngModel)]="password"/>
        </div>
        <button class="btn btn-primary" type="submit" [disabled]="saving || !email">{{ saving ? "Saving…" : "Save account" }}</button>
      </form>
      @if (saved) { <p class="mt-2 mb-0">Account settings saved.</p> }
      @if (error) {
        <div class="alert alert-danger d-flex align-items-start gap-2 mt-2" role="alert">
          <fa-icon [icon]="faCircleExclamation"/><div><strong>Could not save account settings</strong><div>{{ error }}</div></div>
        </div>
      }
    </details>
  `
})
export class OsMapsPersonalAccountComponent implements OnInit {
  private service = inject(OsMapsExportService);
  @Output() configured = new EventEmitter<boolean>();
  email = "";
  password = "";
  saving = false;
  saved = false;
  error = "";
  faCircleExclamation = faCircleExclamation;

  async ngOnInit(): Promise<void> {
    try {
      const account = await this.service.personalAccount();
      this.email = account.email;
      this.configured.emit(account.configured);
    } catch {
      this.error = "Could not load your personal settings. Please try again.";
    }
  }

  async save(): Promise<void> {
    this.saving = true;
    this.saved = false;
    this.error = "";
    try {
      const account = await this.service.savePersonalAccount({email: this.email, password: this.password});
      this.password = "";
      this.email = account.email;
      this.saved = true;
      this.configured.emit(account.configured);
    } catch {
      this.error = "Check your email and password and try again.";
    } finally {
      this.saving = false;
    }
  }
}

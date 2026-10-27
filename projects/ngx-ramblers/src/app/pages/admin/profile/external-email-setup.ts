import { Component } from "@angular/core";
import { PageComponent } from "../../../page/page.component";
import { MailClientPasswordsComponent } from "./mail-client-passwords";

@Component({
  selector: "app-external-email-setup",
  imports: [PageComponent, MailClientPasswordsComponent],
  template: `
    <app-page pageTitle="External Email Setup">
      <app-mail-client-passwords/>
    </app-page>
  `
})
export class ExternalEmailSetupComponent {
}

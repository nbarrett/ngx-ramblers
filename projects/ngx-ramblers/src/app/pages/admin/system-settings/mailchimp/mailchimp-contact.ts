import { Component, Input } from "@angular/core";
import { MailchimpContact } from "../../../../models/server-models";
import { FormsModule } from "@angular/forms";

@Component({
    selector: "app-mailchimp-contact",
    templateUrl: "./mailchimp-contact.html",
    imports: [FormsModule]
})
export class MailchimpContactComponent {
  @Input()
  mailchimpContact: MailchimpContact;

}

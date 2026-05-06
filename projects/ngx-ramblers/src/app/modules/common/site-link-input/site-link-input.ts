import { Component, EventEmitter, inject, Input, OnInit, Output } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { TypeaheadDirective } from "ngx-bootstrap/typeahead";
import { PageContentService } from "../../../services/page-content.service";
import { UrlService } from "../../../services/url.service";

@Component({
  selector: "app-site-link-input",
  imports: [FormsModule, TypeaheadDirective],
  template: `
    <input type="text"
           autocomplete="off"
           [class]="cssClass"
           [id]="inputId ?? null"
           [placeholder]="placeholder ?? ''"
           [disabled]="disabled"
           [typeahead]="pageContentService.siteLinks"
           [typeaheadMinLength]="0"
           [ngModel]="value"
           [ngModelOptions]="{ standalone: true }"
           (ngModelChange)="onValueChange($event)"
           (blur)="onBlur()"/>
  `
})
export class SiteLinkInputComponent implements OnInit {

  protected pageContentService = inject(PageContentService);
  private urlService = inject(UrlService);

  @Input() value: string | null = "";
  @Input() inputId?: string;
  @Input() placeholder?: string;
  @Input() disabled = false;
  @Input() cssClass = "form-control";
  @Input() normaliseOnBlur = true;
  @Output() valueChange = new EventEmitter<string>();

  ngOnInit(): void {
    this.pageContentService.refreshLookups();
  }

  onValueChange(next: string): void {
    this.value = next ?? "";
    this.valueChange.emit(this.value);
  }

  onBlur(): void {
    if (!this.normaliseOnBlur) return;
    const normalised = this.urlService.reformatLocalHref(this.value ?? "");
    if (normalised !== this.value) {
      this.value = normalised;
      this.valueChange.emit(normalised);
    }
  }
}

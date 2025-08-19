import { Component, inject, Input, OnInit } from "@angular/core";
import { faAdd } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { SystemConfig } from "../../../../models/system.model";
import { Logger, LoggerFactory } from "../../../../services/logger-factory.service";
import { SystemConfigService } from "../../../../services/system/system-config.service";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";
import { enumKeyValues, KeyValue } from "../../../../functions/enums";
import { LinkStyle, ListStyle } from "../../../../models/content-text.model";
import { StringUtilsService } from "../../../../services/string-utils.service";
import { MarkdownComponent } from "ngx-markdown";

@Component({
  selector: "[app-global-styles]",
  template: `
    <div class="img-thumbnail thumbnail-admin-edit">
      <div class="img-thumbnail thumbnail-2">
        <div class="thumbnail-heading">Global Style Defaults</div>
        @if (config?.globalStyles) {
          <div class="d-flex">
            <div class="col-2">
              <label for="link-style-select">Link Style</label></div>
            <div class="col-2">
              <select [(ngModel)]="config.globalStyles.link"
                      class="form-control ml-3" id="link-style-select">
                @for (linkStyle of linkStyles; track linkStyle.key) {
                  <option [ngValue]="linkStyle.value">{{ stringUtils.asTitle(linkStyle.key) }}</option>
                }
              </select>
            </div>
            <div class="col-8 flex-grow-1">
              <div markdown class="mt-2 {{config.globalStyles.link}}">
                Within text [links look like this]("") followed by some text
              </div>
            </div>
          </div>
          <div class="d-flex">
            <div class="col-2">
              <label for="list-style-select">List Style</label>
            </div>
            <div class="col-2">
              <select [(ngModel)]="config.globalStyles.list"
                      class="form-control ml-3" id="list-style-select">
                @for (listStyle of listStyles; track listStyle.key) {
                  <option [ngValue]="listStyle.value">{{ stringUtils.asTitle(listStyle.key) }}</option>
                }
              </select>
            </div>
            <div class="col-8 flex-grow-1 mt-2">Within text lists look like this:
              <li class="list-style-{{config.globalStyles.list}}">Item one</li>
              <li class="list-style-{{config.globalStyles.list}}">Item two</li>
              <li class="list-style-{{config.globalStyles.list}}">Item three</li>
              Followed by some text
            </div>
          </div>
        }
      </div>
    </div>`,
  imports: [ReactiveFormsModule, FormsModule, MarkdownComponent]
})
export class GlobalStyles implements OnInit {

  private logger: Logger = inject(LoggerFactory).createLogger("ImageCollectionSettingsComponent", NgxLoggerLevel.ERROR);
  stringUtils = inject(StringUtilsService);
  linkStyles: KeyValue<string>[] = enumKeyValues(LinkStyle);
  listStyles: KeyValue<string>[] = enumKeyValues(ListStyle);
  protected systemConfigService = inject(SystemConfigService);
  faAdd = faAdd;
  @Input() config: SystemConfig;

  protected readonly JSON = JSON;

  ngOnInit() {
    this.logger.info("constructed:config:", this.config);
    if (!this.config?.globalStyles) {
      this.config.globalStyles = this.systemConfigService.defaultHasStyles();
    }
  }
}

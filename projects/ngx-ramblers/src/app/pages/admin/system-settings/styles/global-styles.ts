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
import { DEFAULT_EMOJI_SYNONYMS, emojiSynonymsFromText, emojiSynonymsToText } from "../../../../models/emoji.model";

@Component({
  selector: "[app-global-styles]",
  template: `
    <div class="img-thumbnail thumbnail-admin-edit">
      <div class="thumbnail-heading-frame">
        <div class="thumbnail-heading">Global Style Defaults</div>
        @if (config?.globalStyles) {
          <div class="row align-items-center">
            <div class="col-12 col-md-2 mb-2 mb-md-0">
              <label for="link-style-select">Link Style</label></div>
            <div class="col-12 col-md-2 mb-2 mb-md-0">
              <select [(ngModel)]="config.globalStyles.link"
                      class="form-control" id="link-style-select">
                @for (linkStyle of linkStyles; track linkStyle.key) {
                  <option [ngValue]="linkStyle.value">{{ stringUtils.asTitle(linkStyle.key) }}</option>
                }
              </select>
            </div>
            <div class="col-12 col-md-8">
              <div markdown class="mt-2 mt-md-0 {{config.globalStyles.link}}">
                Within text [links look like this]("") followed by some text
              </div>
            </div>
          </div>
          <div class="row align-items-center mt-3">
            <div class="col-12 col-md-2 mb-2 mb-md-0">
              <label for="list-style-select">List Style</label>
            </div>
            <div class="col-12 col-md-2 mb-2 mb-md-0">
              <select [(ngModel)]="config.globalStyles.list"
                      class="form-control" id="list-style-select">
                @for (listStyle of listStyles; track listStyle.key) {
                  <option [ngValue]="listStyle.value">{{ stringUtils.asTitle(listStyle.key) }}</option>
                }
              </select>
            </div>
            <div class="col-12 col-md-8 mt-2 mt-md-0">Within text lists look like this:
              <li class="list-style-{{config.globalStyles.list}}">Item one</li>
              <li class="list-style-{{config.globalStyles.list}}">Item two</li>
              <li class="list-style-{{config.globalStyles.list}}">Item three</li>
              Followed by some text
            </div>
          </div>
        }
      </div>
    </div>
    <div class="img-thumbnail thumbnail-admin-edit mt-3">
      <div class="thumbnail-heading-frame">
        <div class="thumbnail-heading">Emoji Shortcuts</div>
        <div class="row">
          <div class="col-12">
            <p>Typing <code>:word</code> in a caption or description offers a matching emoji. Add a word here to
              also offer a set of emojis for it, one word per line, followed by a colon and the emoji names
              (comma separated, no colons needed around them). For example <code>thanks: pray, clap,
                raised_hands</code> means typing <code>:thanks</code> also offers 🙏, 👏 and 🙌. Leave this
              blank to use the built-in defaults.</p>
            <textarea class="form-control" rows="10" id="emoji-shortcuts"
                      [ngModel]="emojiShortcutsText"
                      (ngModelChange)="onEmojiShortcutsChange($event)"
                      placeholder="{{ defaultEmojiShortcutsText }}"></textarea>
          </div>
        </div>
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
  protected emojiShortcutsText = "";
  protected readonly defaultEmojiShortcutsText = emojiSynonymsToText(DEFAULT_EMOJI_SYNONYMS);

  ngOnInit() {
    this.logger.info("constructed:config:", this.config);
    if (!this.config?.globalStyles) {
      this.config.globalStyles = this.systemConfigService.defaultHasStyles();
    }
    this.emojiShortcutsText = emojiSynonymsToText(this.config?.emoji?.synonyms || []);
  }

  onEmojiShortcutsChange(text: string): void {
    this.emojiShortcutsText = text;
    this.config.emoji = {synonyms: emojiSynonymsFromText(text)};
  }
}

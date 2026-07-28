import {
  Directive,
  ElementRef,
  HostListener,
  inject,
  Input,
  OnDestroy,
  Renderer2
} from "@angular/core";
import { EmojiShortcodeMatch } from "../../../models/emoji.model";
import { EmojiShortcodeService } from "../../../services/emoji/emoji-shortcode.service";

@Directive({
  selector: "textarea[appEmojiShortcodes], input[appEmojiShortcodes]",
  standalone: true
})
export class EmojiShortcodesDirective implements OnDestroy {

  @Input() emojiLimit = 36;

  private host = inject(ElementRef<HTMLInputElement | HTMLTextAreaElement>);
  private renderer = inject(Renderer2);
  private emojiShortcodes = inject(EmojiShortcodeService);
  private suggestions: EmojiShortcodeMatch[] = [];
  private activeIndex = 0;
  private shortcodeRange: {start: number; end: number} = null;
  private menu: HTMLElement = null;
  private documentClickUnlisten: (() => void) = null;

  ngOnDestroy(): void {
    this.destroyMenu();
  }

  @HostListener("input")
  onInput(): void {
    this.refreshSuggestions();
  }

  @HostListener("keydown", ["$event"])
  onKeydown(event: KeyboardEvent): void {
    if (this.suggestions.length > 0) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        this.activeIndex = (this.activeIndex + 1) % this.suggestions.length;
        this.renderMenu();
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        this.activeIndex = (this.activeIndex - 1 + this.suggestions.length) % this.suggestions.length;
        this.renderMenu();
      } else if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        this.applySuggestion(this.suggestions[this.activeIndex]);
      } else if (event.key === "Escape") {
        event.preventDefault();
        this.clearSuggestions();
      }
    }
  }

  @HostListener("blur")
  onBlur(): void {
    setTimeout(() => this.clearSuggestions(), 120);
  }

  private refreshSuggestions(): void {
    const field = this.host.nativeElement;
    const value = field.value || "";
    const cursor = field.selectionStart || 0;
    const textBeforeCursor = value.slice(0, cursor);
    const match = textBeforeCursor.match(/:([a-z0-9_+-]*)$/i);
    if (match) {
      this.shortcodeRange = {start: cursor - match[0].length, end: cursor};
      this.suggestions = this.emojiShortcodes.suggestionsFor(match[1], this.emojiLimit);
      this.activeIndex = 0;
      this.renderMenu();
    } else {
      this.clearSuggestions();
    }
  }

  private applySuggestion(suggestion: EmojiShortcodeMatch): void {
    const field = this.host.nativeElement;
    if (field && this.shortcodeRange && suggestion) {
      const value = field.value || "";
      const before = value.slice(0, this.shortcodeRange.start);
      const after = value.slice(this.shortcodeRange.end);
      const insertion = `${suggestion.unicode} `;
      const nextValue = `${before}${insertion}${after}`;
      const cursor = before.length + insertion.length;
      field.value = nextValue;
      field.dispatchEvent(new Event("input", {bubbles: true}));
      field.setSelectionRange(cursor, cursor);
      this.clearSuggestions();
      field.focus();
    }
  }

  private clearSuggestions(): void {
    this.suggestions = [];
    this.activeIndex = 0;
    this.shortcodeRange = null;
    this.destroyMenu();
  }

  private renderMenu(): void {
    this.destroyMenu();
    if (this.suggestions.length > 0) {
    const field = this.host.nativeElement;
    const rect = field.getBoundingClientRect();
    const menu = this.renderer.createElement("ul");
    this.renderer.addClass(menu, "emoji-shortcode-suggestions");
    this.renderer.setAttribute(menu, "role", "listbox");
    this.renderer.setStyle(menu, "position", "fixed");
    this.renderer.setStyle(menu, "left", `${Math.round(rect.left)}px`);
    this.renderer.setStyle(menu, "top", `${Math.round(rect.bottom + 4)}px`);
    this.renderer.setStyle(menu, "width", `${Math.round(rect.width)}px`);
    this.renderer.setStyle(menu, "z-index", "2000");
    this.renderer.setStyle(menu, "margin", "0");
    this.renderer.setStyle(menu, "padding", "4px 0");
    this.renderer.setStyle(menu, "list-style", "none");
    this.renderer.setStyle(menu, "max-height", "360px");
    this.renderer.setStyle(menu, "overflow-y", "auto");
    this.renderer.setStyle(menu, "background", "#fff");
    this.renderer.setStyle(menu, "border", "1px solid rgba(15, 23, 42, 0.15)");
    this.renderer.setStyle(menu, "border-radius", "6px");
    this.renderer.setStyle(menu, "box-shadow", "0 8px 24px rgba(15, 23, 42, 0.12)");

    this.suggestions.forEach((suggestion, index) => {
      const item = this.renderer.createElement("li");
      this.renderer.setAttribute(item, "role", "option");
      this.renderer.setStyle(item, "display", "flex");
      this.renderer.setStyle(item, "align-items", "center");
      this.renderer.setStyle(item, "gap", "10px");
      this.renderer.setStyle(item, "padding", "8px 12px");
      this.renderer.setStyle(item, "cursor", "pointer");
      this.renderer.setStyle(item, "font-size", "0.9rem");
      if (index === this.activeIndex) {
        this.renderer.setStyle(item, "background", "rgba(249, 177, 4, 0.12)");
      }
      const emoji = this.renderer.createElement("span");
      this.renderer.setStyle(emoji, "font-size", "1.25rem");
      this.renderer.setStyle(emoji, "width", "1.5rem");
      this.renderer.setStyle(emoji, "text-align", "center");
      this.renderer.setStyle(emoji, "flex-shrink", "0");
      this.renderer.appendChild(emoji, this.renderer.createText(suggestion.unicode));
      const name = this.renderer.createElement("span");
      this.renderer.setStyle(name, "color", "rgb(110, 112, 115)");
      this.renderer.setStyle(name, "font-family", "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace");
      this.renderer.setStyle(name, "font-size", "0.8rem");
      this.renderer.appendChild(name, this.renderer.createText(suggestion.shortname));
      this.renderer.appendChild(item, emoji);
      this.renderer.appendChild(item, name);
      this.renderer.listen(item, "mousedown", (event: MouseEvent) => {
        event.preventDefault();
        this.applySuggestion(suggestion);
      });
      this.renderer.appendChild(menu, item);
    });

    this.renderer.appendChild(document.body, menu);
    this.menu = menu;
    this.documentClickUnlisten = this.renderer.listen("document", "mousedown", (event: MouseEvent) => {
      const target = event.target as Node;
      if (target !== field && !menu.contains(target)) {
        this.clearSuggestions();
      }
    });
    }
  }

  private destroyMenu(): void {
    if (this.documentClickUnlisten) {
      this.documentClickUnlisten();
      this.documentClickUnlisten = null;
    }
    if (this.menu) {
      this.renderer.removeChild(document.body, this.menu);
      this.menu = null;
    }
  }
}

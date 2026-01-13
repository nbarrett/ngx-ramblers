import { Component, EventEmitter, inject, Input, Output } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { YouTubeService } from "../../../services/youtube.service";
import { YouTubeQuality } from "../../../models/youtube.model";

@Component({
  selector: "app-youtube-input",
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="youtube-input-container">
      <input
        type="text"
        [class]="inputClass"
        [placeholder]="placeholder"
        [(ngModel)]="inputValue"
        (ngModelChange)="onInputChange($event)"
        (paste)="onPaste($event)">
      @if (showPreview && extractedId) {
        <div class="youtube-preview mt-2">
          <img [src]="thumbnailUrl" [alt]="'YouTube video thumbnail'" class="youtube-thumbnail">
        </div>
      }
      @if (showError && inputValue && !extractedId) {
        <small class="text-danger">Invalid YouTube URL or video ID</small>
      }
    </div>
  `,
  styles: [`
    .youtube-preview
      max-width: 200px

    .youtube-thumbnail
      width: 100%
      height: auto
      border-radius: 4px
  `]
})
export class YoutubeInputComponent {
  private youtubeService: YouTubeService = inject(YouTubeService);

  @Input() inputClass = "form-control";
  @Input() placeholder = "YouTube URL or video ID";
  @Input() showPreview = false;
  @Input() showError = true;

  @Input()
  set youtubeId(value: string) {
    this.inputValue = value || "";
    this.extractedId = value || null;
  }

  @Output() youtubeIdChange = new EventEmitter<string>();

  inputValue = "";
  extractedId: string | null = null;

  get thumbnailUrl(): string | null {
    return this.extractedId ? this.youtubeService.thumbnailUrl(this.extractedId, YouTubeQuality.HQ) : null;
  }

  onInputChange(value: string): void {
    this.extractAndEmit(value);
  }

  onPaste(event: ClipboardEvent): void {
    const pastedText = event.clipboardData?.getData("text");
    if (pastedText) {
      setTimeout(() => this.extractAndEmit(this.inputValue));
    }
  }

  private extractAndEmit(value: string): void {
    const extracted = this.youtubeService.extractVideoId(value);
    this.extractedId = extracted;
    if (extracted) {
      this.inputValue = extracted;
      this.youtubeIdChange.emit(extracted);
    } else if (!value) {
      this.youtubeIdChange.emit("");
    }
  }
}

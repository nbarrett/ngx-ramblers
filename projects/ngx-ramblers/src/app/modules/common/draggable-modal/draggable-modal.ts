import { Component, EventEmitter, HostListener, Input, Output } from "@angular/core";
import { CdkDrag, CdkDragHandle } from "@angular/cdk/drag-drop";

@Component({
  selector: "app-draggable-modal",
  imports: [CdkDrag, CdkDragHandle],
  styleUrls: ["./draggable-modal.sass"],
  template: `
    @if (open) {
      <div class="modal fade show d-block draggable-modal" tabindex="-1"
           (mousedown)="onBackdropMouseDown($event)">
        <div class="modal-dialog modal-lg" cdkDrag cdkDragBoundary=".draggable-modal">
          <div class="modal-content" [style.width]="contentWidth">
            <div class="modal-header" cdkDragHandle>
              <div class="modal-title min-width-0">
                <ng-content select="[modalTitle]"/>
              </div>
              <button type="button" class="btn-close btn-close-white" aria-label="Close"
                      (click)="requestClose()"></button>
            </div>
            <div class="modal-body draggable-modal-body">
              <ng-content select="[modalBody]"/>
            </div>
            <div class="modal-footer">
              <ng-content select="[modalFooter]"/>
              @if (showCloseButton) {
                <button type="button" class="btn btn-secondary" (click)="requestClose()">Close</button>
              }
            </div>
          </div>
        </div>
      </div>
      <div class="modal-backdrop fade show"></div>
    }
  `
})
export class DraggableModalComponent {
  @Input() open = false;
  @Input() contentWidth = "min(800px, 95vw)";
  @Input() showCloseButton = true;
  @Output() closed = new EventEmitter<void>();

  protected requestClose(): void {
    this.closed.emit();
  }

  protected onBackdropMouseDown(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.requestClose();
    }
  }

  @HostListener("document:keydown.escape")
  protected onEscape(): void {
    if (this.open) {
      this.requestClose();
    }
  }
}

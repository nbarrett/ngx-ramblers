import { afterNextRender, Component, ElementRef, EventEmitter, HostListener, inject, Injector, Input, OnDestroy, Output, ViewChild } from "@angular/core";
import { CdkDrag, CdkDragHandle } from "@angular/cdk/drag-drop";
import { DraggableModalMotion } from "../../../models/draggable-modal.model";

const pageScrollLock = {count: 0};
const MOTION_MS = 320;

@Component({
  selector: "app-draggable-modal",
  imports: [CdkDrag, CdkDragHandle],
  styleUrls: ["./draggable-modal.sass"],
  template: `
    @if (shown) {
      <div class="modal fade show d-block draggable-modal" tabindex="-1"
           [class.minimise-pending]="expandPending"
           [class.minimise-expanding]="motion === DraggableModalMotion.EXPANDING"
           [class.minimise-collapsing]="motion === DraggableModalMotion.MINIMISING"
           (mousedown)="onBackdropMouseDown($event)">
        <div class="modal-dialog modal-lg" cdkDrag cdkDragBoundary=".draggable-modal">
          <div class="modal-minimise" #minimiseShell (animationend)="onMotionAnimationEnd($event)">
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
      </div>
      <div class="modal-backdrop fade show"
           [class.minimise-expanding]="motion === DraggableModalMotion.EXPANDING"
           [class.minimise-collapsing]="motion === DraggableModalMotion.MINIMISING"></div>
    }
  `
})
export class DraggableModalComponent implements OnDestroy {
  shown = false;
  motion: DraggableModalMotion = DraggableModalMotion.IDLE;
  holdingPageScroll = false;
  holdingWheel = false;
  @Input() contentWidth = "min(800px, 95vw)";
  @Input() showCloseButton = true;
  @Input() minimiseTarget: HTMLElement | null = null;
  @Output() closed = new EventEmitter<void>();
  @ViewChild("minimiseShell") private minimiseShell: ElementRef<HTMLElement>;
  protected readonly DraggableModalMotion = DraggableModalMotion;
  private injector = inject(Injector);
  private motionEnd = {token: 0};
  protected wantedOpen = false;
  protected expandPending = false;
  private wheelListener = (event: WheelEvent): void => {
    this.containDocumentScroll(event);
  };

  @Input() set open(value: boolean) {
    this.wantedOpen = !!value;
    if (this.wantedOpen && !this.shown) {
      this.shown = true;
      this.syncPageScrollLock(true);
      this.playExpand();
    } else if (!this.wantedOpen && this.shown) {
      this.playMinimise();
    }
  }

  get open(): boolean {
    return this.wantedOpen;
  }

  ngOnDestroy(): void {
    this.wantedOpen = false;
    this.shown = false;
    this.expandPending = false;
    this.syncPageScrollLock(false);
  }

  protected requestClose(): void {
    this.closed.emit();
  }

  protected onBackdropMouseDown(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.requestClose();
    }
  }

  protected onMotionAnimationEnd(event: AnimationEvent): void {
    if (event.target === this.minimiseShell?.nativeElement) {
      this.finishMotion();
    }
  }

  @HostListener("document:keydown.escape")
  protected onEscape(): void {
    if (this.wantedOpen) {
      this.requestClose();
    }
  }

  private playExpand(): void {
    if (this.minimiseTarget) {
      this.expandPending = true;
      this.motion = DraggableModalMotion.IDLE;
      afterNextRender(() => {
        if (this.wantedOpen && this.shown) {
          this.applyOriginVars();
          this.expandPending = false;
          this.motion = DraggableModalMotion.EXPANDING;
          this.scheduleMotionEnd();
        } else {
          this.expandPending = false;
        }
      }, {injector: this.injector});
    } else {
      this.expandPending = false;
      this.motion = DraggableModalMotion.IDLE;
    }
  }

  private playMinimise(): void {
    this.expandPending = false;
    if (this.minimiseTarget) {
      this.applyOriginVars();
      this.motion = DraggableModalMotion.MINIMISING;
      this.scheduleMotionEnd();
    } else {
      this.shown = false;
      this.motion = DraggableModalMotion.IDLE;
      this.syncPageScrollLock(false);
    }
  }

  private scheduleMotionEnd(): void {
    const token = this.motionEnd.token + 1;
    this.motionEnd = {token};
    window.setTimeout(() => {
      if (this.motionEnd.token === token) {
        this.finishMotion();
      }
    }, MOTION_MS + 40);
  }

  private finishMotion(): void {
    this.motionEnd = {token: this.motionEnd.token + 1};
    if (this.motion === DraggableModalMotion.MINIMISING) {
      this.shown = false;
      this.syncPageScrollLock(false);
    }
    this.motion = DraggableModalMotion.IDLE;
  }

  private applyOriginVars(): void {
    const shell = this.minimiseShell?.nativeElement;
    const target = this.minimiseTarget;
    if (shell && target) {
      const from = shell.getBoundingClientRect();
      const to = target.getBoundingClientRect();
      const dx = to.left + to.width / 2 - (from.left + from.width / 2);
      const dy = to.top + to.height / 2 - (from.top + from.height / 2);
      const scale = Math.max(0.08, Math.min(to.width / Math.max(from.width, 1), to.height / Math.max(from.height, 1)));
      shell.style.setProperty("--minimise-x", `${dx}px`);
      shell.style.setProperty("--minimise-y", `${dy}px`);
      shell.style.setProperty("--minimise-scale", `${scale}`);
    }
  }

  private containDocumentScroll(event: WheelEvent): void {
    const overModal = event.composedPath().some(node =>
      node instanceof HTMLElement && node.classList.contains("draggable-modal")
    );
    if (overModal) {
      event.preventDefault();
      event.stopPropagation();
      const scroller = event.composedPath().find(node =>
        node instanceof HTMLElement
        && !node.classList.contains("draggable-modal")
        && this.elementCanScroll(node, event.deltaY)
      ) as HTMLElement;
      if (scroller) {
        scroller.scrollTop += event.deltaY;
      }
    }
  }

  private elementCanScroll(element: HTMLElement, deltaY: number): boolean {
    const canScroll = element.scrollHeight > element.clientHeight + 1;
    if (!canScroll) {
      return false;
    } else if (deltaY < 0) {
      return element.scrollTop > 0;
    } else {
      return element.scrollTop + element.clientHeight < element.scrollHeight - 1;
    }
  }

  private syncPageScrollLock(lock: boolean): void {
    if (lock && !this.holdingPageScroll) {
      pageScrollLock.count += 1;
      this.holdingPageScroll = true;
      if (pageScrollLock.count === 1) {
        document.body.style.overflow = "hidden";
      }
    } else if (!lock && this.holdingPageScroll) {
      pageScrollLock.count = Math.max(0, pageScrollLock.count - 1);
      this.holdingPageScroll = false;
      if (pageScrollLock.count === 0) {
        document.body.style.overflow = "";
      }
    }
    this.syncWheelLock(lock);
  }

  private syncWheelLock(lock: boolean): void {
    if (lock && !this.holdingWheel) {
      document.addEventListener("wheel", this.wheelListener, {passive: false, capture: true});
      this.holdingWheel = true;
    } else if (!lock && this.holdingWheel) {
      document.removeEventListener("wheel", this.wheelListener, {capture: true});
      this.holdingWheel = false;
    }
  }
}

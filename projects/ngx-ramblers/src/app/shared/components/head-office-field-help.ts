import { AfterViewInit, ChangeDetectorRef, Component, Directive, ElementRef, inject, Input, OnDestroy, OnInit, Renderer2 } from "@angular/core";
import { Subscription } from "rxjs";
import { HEAD_OFFICE_FIELD_HELP_ID, RAMBLERS_MY_DETAILS_TRAIL, RAMBLERS_MY_DETAILS_URL } from "../../models/ramblers-account.model";
import { isHeadOfficeLockedField } from "../../models/member-sync-policy.model";
import { MemberSyncPolicyService } from "../../services/member/member-sync-policy.service";

@Directive({
  selector: "[appHeadOfficeLock]",
  standalone: true
})
export class HeadOfficeLockDirective implements OnInit, AfterViewInit, OnDestroy {
  @Input({required: true, alias: "appHeadOfficeLock"}) fieldName: string;

  private host = inject(ElementRef<HTMLElement>);
  private renderer = inject(Renderer2);
  private changeDetector = inject(ChangeDetectorRef);
  private memberSyncPolicyService = inject(MemberSyncPolicyService);
  private subscriptions: Subscription[] = [];
  private markNode: Text | null = null;
  private labelledElement: HTMLElement | null = null;
  private locked = false;

  ngOnInit(): void {
    this.subscriptions.push(this.memberSyncPolicyService.events().subscribe(() => {
      this.locked = isHeadOfficeLockedField(this.fieldName, this.memberSyncPolicyService.effectiveMode(this.fieldName));
      this.sync();
      this.changeDetector.markForCheck();
    }));
    void this.memberSyncPolicyService.refresh();
  }

  ngAfterViewInit(): void {
    this.sync();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
    this.locked = false;
    this.sync();
  }

  private sync(): void {
    this.syncLabelMark();
    this.syncControl();
  }

  private labelElement(): HTMLElement | null {
    const host = this.host.nativeElement;
    return host.tagName === "LABEL" ? host : host.querySelector("label");
  }

  private controlElement(): HTMLElement | null {
    const host = this.host.nativeElement;
    return ["INPUT", "SELECT", "TEXTAREA"].includes(host.tagName) ? host : host.querySelector("input, select, textarea");
  }

  private syncLabelMark(): void {
    const label = this.labelElement();
    if (label) {
      this.labelledElement = label;
      if (this.locked) {
        if (!this.markNode) {
          this.markNode = this.renderer.createText(" *");
          this.renderer.appendChild(label, this.markNode);
        }
      } else if (this.markNode) {
        this.renderer.removeChild(this.labelledElement, this.markNode);
        this.markNode = null;
      }
    }
  }

  private syncControl(): void {
    const control = this.controlElement();
    if (control) {
      this.renderer.setProperty(control, "disabled", this.locked);
      if (this.locked) {
        this.renderer.setAttribute(control, "aria-describedby", HEAD_OFFICE_FIELD_HELP_ID);
      } else {
        this.renderer.removeAttribute(control, "aria-describedby");
      }
    }
  }
}

@Component({
  selector: "app-head-office-field-help",
  template: `
    @if (visible) {
      <small [id]="helpId" class="d-block form-text text-muted mb-0">
        Fields marked with an asterisk can't be updated here. To do this, visit <a [href]="ramblersMyDetailsUrl" target="_blank" rel="noopener noreferrer">{{ ramblersMyDetailsTrail }}</a>.
      </small>
    }
  `
})
export class HeadOfficeFieldHelpComponent implements OnInit, OnDestroy {
  @Input() fields: string[] = [];

  readonly ramblersMyDetailsUrl = RAMBLERS_MY_DETAILS_URL;
  readonly ramblersMyDetailsTrail = RAMBLERS_MY_DETAILS_TRAIL;
  readonly helpId = HEAD_OFFICE_FIELD_HELP_ID;
  visible = false;

  private memberSyncPolicyService = inject(MemberSyncPolicyService);
  private subscriptions: Subscription[] = [];

  ngOnInit(): void {
    this.subscriptions.push(this.memberSyncPolicyService.events().subscribe(() => {
      this.visible = this.fields.some(fieldName => isHeadOfficeLockedField(fieldName, this.memberSyncPolicyService.effectiveMode(fieldName)));
    }));
    void this.memberSyncPolicyService.refresh();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }
}

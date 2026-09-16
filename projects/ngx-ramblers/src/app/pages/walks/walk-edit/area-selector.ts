import { booleanAttribute, Component, EventEmitter, inject, Input, OnInit, Output } from "@angular/core";
import { DropdownPosition, NgSelectComponent } from "@ng-select/ng-select";
import { FormsModule } from "@angular/forms";
import { NgxLoggerLevel } from "ngx-logger";
import { AvailableAreaWithLabel } from "../../../models/system.model";
import { AvailableAreasService } from "../../../services/available-areas.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { StatusIconComponent } from "../../admin/status-icon";
import { Status } from "../../../models/ramblers-upload-audit.model";

@Component({
  selector: "app-area-selector",
  imports: [NgSelectComponent, FormsModule, StatusIconComponent],
  styles: [`
    .area-status-icon
      position: absolute
      right: 32px
      top: 50%
      transform: translateY(-50%)
      z-index: 10
      pointer-events: none
  `],
  template: `
    <div class="form-group">
      @if (label) {
        <label [for]="id">{{ label }}@if (showCount) { ({{ loading ? "retrieving areas..." : areas.length + " areas available" }})}</label>
      }
      <div class="position-relative">
        <ng-select [id]="id"
                   [items]="areas"
                   bindLabel="ngSelectLabel"
                   bindValue="areaCode"
                   [searchable]="true"
                   [clearable]="clearable"
                   [disabled]="disabled"
                   [loading]="loading"
                   [dropdownPosition]="dropdownPosition"
                   [placeholder]="placeholder"
                   [ngModel]="areaCode"
                   (ngModelChange)="areaCodeChanged($event)"/>
        @if (showStatus) {
          <app-status-icon noLabel [status]="status" class="area-status-icon"/>
        }
      </div>
    </div>
  `
})
export class AreaSelector implements OnInit {
  private availableAreasService = inject(AvailableAreasService);
  private logger: Logger = inject(LoggerFactory).createLogger("AreaSelector", NgxLoggerLevel.ERROR);
  @Input() id = "area-select";
  @Input() label = "Area";
  @Input() areaCode: string;
  @Input() placeholder = "Select an area...";
  @Input({transform: booleanAttribute}) clearable = true;
  @Input({transform: booleanAttribute}) disabled = false;
  @Input({transform: booleanAttribute}) showCount = false;
  @Input({transform: booleanAttribute}) showStatus = false;
  @Input() dropdownPosition: DropdownPosition = "bottom";
  @Output() areaChanged: EventEmitter<AvailableAreaWithLabel | null> = new EventEmitter();
  areas: AvailableAreaWithLabel[] = [];
  loading = false;
  status: Status = Status.INFO;

  async ngOnInit(): Promise<void> {
    this.loading = true;
    this.status = Status.ACTIVE;
    try {
      this.areas = await this.availableAreasService.areas();
      this.status = this.areas.length > 0 ? Status.COMPLETE : Status.ERROR;
    } catch (error) {
      this.logger.error("Failed to load available areas:", error);
      this.status = Status.ERROR;
    } finally {
      this.loading = false;
    }
  }

  areaCodeChanged(areaCode: string | null): void {
    this.areaCode = areaCode;
    this.areaChanged.emit(this.areas.find(area => area.areaCode === areaCode) || null);
  }
}

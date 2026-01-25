import { Component, EventEmitter, inject, Input, OnInit, Output } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { NgLabelTemplateDirective, NgOptionTemplateDirective, NgSelectComponent } from "@ng-select/ng-select";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { VenueType } from "../../../models/event-venue.model";
import { WalksReferenceService } from "../../../services/walks/walks-reference-data.service";

@Component({
  selector: "app-venue-type-select",
  standalone: true,
  imports: [FormsModule, NgSelectComponent, NgOptionTemplateDirective, NgLabelTemplateDirective, FontAwesomeModule],
  styles: [`
    .venue-type-item
      display: flex
      align-items: center
    .venue-type-icon
      width: 24px
      text-align: center
      margin-right: 0.5rem
      flex-shrink: 0
  `],
  template: `
    <ng-select
      [items]="venueTypes"
      [disabled]="disabled"
      [clearable]="clearable"
      [searchable]="searchable"
      [placeholder]="placeholder"
      bindLabel="type"
      [(ngModel)]="selectedType"
      (ngModelChange)="onTypeChange($event)">
      <ng-template ng-label-tmp let-item="item">
        <div class="venue-type-item">
          <fa-icon [icon]="item.icon" class="venue-type-icon colour-mintcake"></fa-icon>
          <span>{{ item.type }}</span>
        </div>
      </ng-template>
      <ng-template ng-option-tmp let-item="item">
        <div class="venue-type-item">
          <fa-icon [icon]="item.icon" class="venue-type-icon colour-mintcake"></fa-icon>
          <span>{{ item.type }}</span>
        </div>
      </ng-template>
    </ng-select>
  `
})
export class VenueTypeSelect implements OnInit {
  private walksReferenceService = inject(WalksReferenceService);

  @Input() disabled = false;
  @Input() clearable = true;
  @Input() searchable = false;
  @Input() placeholder = "Select type";
  @Input() set value(type: VenueType | null) {
    this.selectedType = type;
  }
  @Output() valueChange = new EventEmitter<VenueType | null>();

  venueTypes: VenueType[];
  selectedType: VenueType | null = null;

  ngOnInit() {
    this.venueTypes = this.walksReferenceService.venueTypes();
  }

  onTypeChange(type: VenueType | null) {
    this.valueChange.emit(type);
  }
}

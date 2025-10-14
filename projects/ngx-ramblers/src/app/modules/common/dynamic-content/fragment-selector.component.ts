import { Component, EventEmitter, inject, Input, OnInit, Output } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { NgSelectModule } from "@ng-select/ng-select";
import { NgxLoggerLevel } from "ngx-logger";
import { FragmentWithLabel } from "../../../models/content-text.model";
import { FragmentService } from "../../../services/fragment.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";

@Component({
  selector: "app-fragment-selector",
  standalone: true,
  imports: [FormsModule, NgSelectModule],
  template: `
    <ng-select
      [id]="elementId"
      [name]="elementId"
      [items]="fragmentsWithLabels"
      bindLabel="ngSelectAttributes.label"
      [searchable]="true"
      [clearable]="true"
      [multiple]="false"
      [addTag]="false"
      [placeholder]="placeholder"
      [ngModel]="selectedFragment"
      (ngModelChange)="onFragmentChange($event)"
      (open)="onDropdownOpen()"
      [compareWith]="compareFragments"
      [class]="cssClass">
    </ng-select>
  `
})
export class FragmentSelectorComponent implements OnInit {
  @Input() elementId = "fragment-selector";
  @Input() selectedFragment: FragmentWithLabel | null = null;
  @Input() placeholder = "Select or search fragment";
  @Input() cssClass = "";
  @Output() fragmentChange = new EventEmitter<FragmentWithLabel>();

  private logger: Logger = inject(LoggerFactory).createLogger("FragmentSelectorComponent", NgxLoggerLevel.INFO);
  private fragmentService = inject(FragmentService);
  fragmentsWithLabels: FragmentWithLabel[] = [];

  ngOnInit(): void {
    this.updateFragmentsList();
  }

  onDropdownOpen(): void {
    this.logger.info("Dropdown opened, refreshing fragments list");
    this.updateFragmentsList();
  }

  private updateFragmentsList(): void {
    const currentFragments = this.fragmentService.fragments;
    this.fragmentsWithLabels = currentFragments.map(fragment => ({
      pageContentId: fragment.id,
      ngSelectAttributes: {label: fragment.path}
    }));
    this.logger.info("Updated fragments list:", this.fragmentsWithLabels.length, "items");
  }

  compareFragments(f1: FragmentWithLabel, f2: FragmentWithLabel): boolean {
    return f1?.pageContentId === f2?.pageContentId;
  }

  onFragmentChange(fragment: FragmentWithLabel): void {
    this.logger.info("Fragment changed:", fragment);
    this.fragmentChange.emit(fragment);
  }
}

import { Component, EventEmitter, Input, Output, inject } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { NgLabelTemplateDirective, NgOptionTemplateDirective, NgSelectComponent } from "@ng-select/ng-select";
import { Difficulty } from "../../models/ramblers-walks-manager";
import { WALK_GRADES, WalkGrade } from "../../models/walk.model";
import { WalkDisplayService } from "../../pages/walks/walk-display.service";

@Component({
  selector: "app-walk-grade-select",
  imports: [FormsModule, NgSelectComponent, NgOptionTemplateDirective, NgLabelTemplateDirective],
  styles: [`
    :host
      display: block

    img.grading-image
      width: 22px
      height: 22px
      vertical-align: middle
  `],
  template: `
    <ng-select [items]="grades"
               [ngModel]="value"
               (ngModelChange)="valueChange.emit($event)"
               [compareWith]="comparer"
               [clearable]="true"
               [searchable]="false"
               [disabled]="disabled"
               [placeholder]="placeholder"
               bindLabel="description"
               [labelForId]="inputId">
      <ng-template ng-label-tmp let-item="item">
        <img class="grading-image" [src]="imageSrc(item)" [alt]="item.description"/>
        <span class="ms-2">{{ item.description }}</span>
      </ng-template>
      <ng-template ng-option-tmp let-item="item">
        <img class="grading-image" [src]="imageSrc(item)" [alt]="item.description"/>
        <span class="ms-2">{{ item.description }}</span>
      </ng-template>
    </ng-select>
  `
})
export class WalkGradeSelect {
  private display = inject(WalkDisplayService);
  protected grades: WalkGrade[] = WALK_GRADES;
  protected comparer = this.display.difficultyComparer;
  @Input() value: Difficulty | null = null;
  @Input() disabled = false;
  @Input() placeholder = "Not set";
  @Input() inputId = "walk-grade";
  @Output() valueChange = new EventEmitter<Difficulty | null>();

  imageSrc(grade: WalkGrade): string {
    return `/assets/images/ramblers/gradings/${grade.image}`;
  }
}

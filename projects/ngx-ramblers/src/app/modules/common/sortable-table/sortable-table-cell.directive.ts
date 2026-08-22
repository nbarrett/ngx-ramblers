import { Directive, Input, TemplateRef, inject } from "@angular/core";

@Directive({
  selector: "[appSortableTableCell]",
})
export class SortableTableCellDirective {
  template: TemplateRef<{ $implicit: any; row: any }> = inject(TemplateRef);
  @Input("appSortableTableCell") key!: string;
}

@Directive({
  selector: "[appSortableTableHeaderCell]",
})
export class SortableTableHeaderCellDirective {
  template: TemplateRef<unknown> = inject(TemplateRef);
  @Input("appSortableTableHeaderCell") key!: string;
}

@Directive({
  selector: "[appSortableTableGroupHeader]",
})
export class SortableTableGroupHeaderDirective {
  template: TemplateRef<{ $implicit: any; group: any }> = inject(TemplateRef);
}

@Directive({
  selector: "[appSortableTableExpandedRow]",
})
export class SortableTableExpandedRowDirective {
  template: TemplateRef<{ $implicit: any; row: any }> = inject(TemplateRef);
}

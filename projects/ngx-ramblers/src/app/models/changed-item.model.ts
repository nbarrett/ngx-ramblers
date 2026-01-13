export interface ChangedItem {
  fieldName: string;
  previousValue?: any;
  currentValue: any;
}

export interface ChangedItemDisplay {
  fieldName: string;
  field: string;
  from: string;
  to: string;
}

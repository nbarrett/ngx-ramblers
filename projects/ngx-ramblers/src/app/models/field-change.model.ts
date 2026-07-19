export interface FieldChange<TField = string, TValue = any> {
  field: TField;
  from: TValue;
  to: TValue;
}

export type FieldChangeEquality<TChange extends FieldChange = FieldChange> = (change: TChange) => boolean;

import { FieldChange, FieldChangeEquality } from "../models/field-change.model";

export function changedFieldValues<TChange extends FieldChange>(candidates: TChange[],
                                                                valuesEqual: FieldChangeEquality<TChange>): TChange[] {
  return candidates.filter(change => !valuesEqual(change));
}

export function mapFieldChangeValues<TField, TSource, TTarget>(change: FieldChange<TField, TSource>,
                                                               transform: (value: TSource) => TTarget): FieldChange<TField, TTarget> {
  return {
    field: change.field,
    from: transform(change.from),
    to: transform(change.to)
  };
}

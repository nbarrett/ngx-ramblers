export interface MongoRegex {
  $regex: string;
  $options: string;
}

export function fieldStartsWithValue(fieldValue: string): MongoRegex {
  return {$regex: "^" + fieldValue, $options: "i"};
}

export function fieldContainsValue(fieldValue: string): MongoRegex {
  return {$regex: fieldValue, $options: "i"};
}

export function fieldEqualsValue(fieldValue: string): MongoRegex {
  return {$regex: "^" + fieldValue + "$", $options: "i"};
}

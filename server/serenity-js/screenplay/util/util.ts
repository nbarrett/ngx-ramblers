export function tail<T>(results: T[]) {
  const [headItem, ...tailItems] = results;
  return tailItems;
}

export function pluraliseWithCount(count: number, singular: string, plural?: string) {
  return `${count} ${pluralise(count, singular, plural)}`;
}

export function pluralise(count: number, singular: string, plural?: string) {
  return `${count === 1 ? singular : plural || (singular + "s")}`;
}

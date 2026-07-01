export function toMb(bytes: number): number {
  return Math.round((bytes / 1048576) * 10) / 10;
}

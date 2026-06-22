export function humanFileSize(size: number) {
  if (!Number.isFinite(size)) {
    return "";
  } else if (size < 1024) {
    return size + " b";
  } else {
    const i = Math.floor(Math.log(size) / Math.log(1024));
    const value = size / Math.pow(1024, i);
    const round = Math.round(value);
    const num = round < 10 ? value.toFixed(2) : round < 100 ? value.toFixed(1) : round;
    return `${num} ${"kmgtpezy"[i - 1]}b`;
  }
}

export function basename(path: string) {
  return path?.split(/[\\/]/)?.pop();
}

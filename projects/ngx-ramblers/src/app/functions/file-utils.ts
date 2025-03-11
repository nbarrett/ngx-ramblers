export function humanFileSize(size: number) {
  if (size < 1024) {
    return size + " b";
  }
  const i = Math.floor(Math.log(size) / Math.log(1024));
  let num: string | number = (size / Math.pow(1024, i));
  const round = Math.round(num);
  num = round < 10 ? num.toFixed(2) : round < 100 ? num.toFixed(1) : round;
  return `${num} ${"kmgtpezy"[i - 1]}b`;
}

export function basename(path: string) {
  return path?.split(/[\\/]/)?.pop();
}

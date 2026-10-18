export interface HeicConversionResult {
  jpeg: Blob | null;
  error: string | null;
}

export interface HeifImage {
  get_width(): number;
  get_height(): number;
  display(target: ImageData, callback: (result: ImageData | null) => void): void;
  free(): void;
}

export interface HeifDecoder {
  decode(input: Uint8Array): HeifImage[];
  decoder: {delete(): void} | null;
}

export interface HeifModule {
  HeifDecoder: new () => HeifDecoder;
}

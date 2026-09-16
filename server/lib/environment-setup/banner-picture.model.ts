export interface BannerPictureStore {
  read(awsFileName: string): Promise<Uint8Array | null>;
  write(awsFileName: string, content: Buffer, contentType: string): Promise<void>;
}

export interface BannerPictureLayout {
  width: number;
  height: number;
  border: number;
  borderColour: string;
  logoWidth: number;
  logoHeight: number;
}

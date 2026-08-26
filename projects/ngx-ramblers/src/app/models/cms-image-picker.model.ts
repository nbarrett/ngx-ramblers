export interface CmsImagePickerImage {
  src: string;
  resolvedSrc: string;
  alt: string;
  pagePath: string;
}

export interface CmsImagePickerPage {
  path: string;
  label: string;
  title: string;
  images: CmsImagePickerImage[];
}

export interface NotificationHost {
  viewContainerRef: {
    clear(): void;
    createComponent<T>(component: unknown): {
      instance: T;
      changeDetectorRef: {
        detectChanges(): void;
      };
      location: {
        nativeElement: {
          innerHTML: string;
        };
      };
    };
  };
}

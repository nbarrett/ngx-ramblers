import { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "org.ngxramblers.walking",
  appName: "Ramblers",
  webDir: "dist/ngx-mobile",
  android: {
    path: "mobile/android",
    useLegacyBridge: true
  },
  ios: {
    path: "mobile/ios"
  },
  plugins: {
    CapacitorHttp: {enabled: true}
  }
};

export default config;

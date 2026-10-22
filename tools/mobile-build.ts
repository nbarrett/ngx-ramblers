import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { AppInstallPlatform } from "../projects/ngx-ramblers/src/app/models/route-follow.model";

const requestedSite = process.env.MOBILE_SITE_URL;
const directoryUrl = process.env.MOBILE_DIRECTORY_URL || requestedSite;
const requestedPlatform = process.env.MOBILE_PLATFORM;
if (requestedPlatform && ![AppInstallPlatform.IOS, AppInstallPlatform.ANDROID].includes(requestedPlatform as AppInstallPlatform)) {
  throw new Error("MOBILE_PLATFORM must be ios or android when supplied.");
}
if (!directoryUrl || new URL(directoryUrl).protocol !== "https:" || new URL(directoryUrl).origin !== directoryUrl.replace(/\/$/, "")) {
  throw new Error("MOBILE_DIRECTORY_URL must be an HTTPS origin for the public area and group directory.");
}
if (requestedSite) {
  const site = new URL(requestedSite);
  if (site.protocol !== "https:" || site.username || site.password || site.pathname !== "/" || site.search || site.hash) {
    throw new Error("MOBILE_SITE_URL must be an HTTPS site origin without credentials, a path or query parameters.");
  }
}
execFileSync("npm", ["run", "build:sw"], {stdio: "inherit"});
execFileSync("npx", ["ng", "build", "--project", "ngx-ramblers", "--configuration", "production"], {stdio: "inherit"});
const mobileDirectory = resolve("dist/ngx-mobile");
rmSync(mobileDirectory, {recursive: true, force: true});
mkdirSync(mobileDirectory, {recursive: true});
cpSync(resolve("dist/ngx-ramblers"), mobileDirectory, {recursive: true});
const indexPath = resolve(mobileDirectory, "index.html");
const bakedSite = requestedSite ? `window.ngxNativeSiteUrl=${JSON.stringify(new URL(requestedSite).origin)};` : "";
const bakedBuild = process.env.MOBILE_BUILD_NUMBER ? `window.ngxNativeBuildNumber=${JSON.stringify(process.env.MOBILE_BUILD_NUMBER)};` : "";
const nativeSetup = `<script>window.ngxNativeDirectoryUrl=${JSON.stringify(new URL(directoryUrl).origin)};${bakedSite}${bakedBuild}const savedWalkingUrl=localStorage.getItem("app-last-url");history.replaceState(null,"",savedWalkingUrl&&/^\\/app(?:\\/|\\?|$)/.test(savedWalkingUrl)?savedWalkingUrl:"/app");</script>`;
writeFileSync(indexPath, readFileSync(indexPath, "utf8").replace("<head>", "<head>" + nativeSetup));
execFileSync("npx", requestedPlatform ? ["cap", "sync", requestedPlatform] : ["cap", "sync"], {stdio: "inherit"});

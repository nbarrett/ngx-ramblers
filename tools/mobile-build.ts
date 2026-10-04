import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const requestedSite = process.env.MOBILE_SITE_URL;
if (!requestedSite) {
  throw new Error("Set MOBILE_SITE_URL to the HTTPS group website before preparing the mobile apps.");
} else {
  const site = new URL(requestedSite);
  if (site.protocol !== "https:" || site.username || site.password || site.pathname !== "/" || site.search || site.hash) {
    throw new Error("MOBILE_SITE_URL must be an HTTPS site origin without credentials, a path or query parameters.");
  } else {
    execFileSync("npm", ["run", "build:sw"], {stdio: "inherit"});
    execFileSync("npx", ["ng", "build", "--project", "ngx-ramblers", "--configuration", "production"], {stdio: "inherit"});
    const mobileDirectory = resolve("dist/ngx-mobile");
    mkdirSync(mobileDirectory, {recursive: true});
    cpSync(resolve("dist/ngx-ramblers"), mobileDirectory, {recursive: true});
    const indexPath = resolve(mobileDirectory, "index.html");
    const nativeSetup = `<script>window.ngxNativeSiteUrl=${JSON.stringify(site.origin)};const savedWalkingUrl=localStorage.getItem("app-last-url");history.replaceState(null,"",savedWalkingUrl&&/^\\/app(?:\\/|\\?|$)/.test(savedWalkingUrl)?savedWalkingUrl:"/app");</script>`;
    writeFileSync(indexPath, readFileSync(indexPath, "utf8").replace("<head>", "<head>" + nativeSetup));
    execFileSync("npx", ["cap", "sync"], {stdio: "inherit"});
  }
}

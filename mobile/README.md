# Using the iPhone and Android walking apps

## What has changed

Until now, deploying the website made the walking app available through the website. Adding it to the phone's Home Screen gave it an app icon, but it still ran using the phone's browser. This is often called a progressive web app, or PWA.

This session added a second way to install the walking app: an actual iPhone or Android application. It contains the existing walking screens and a native GPS recorder that can continue while another app is open or the screen is locked. There is no third-party location licence for this recorder.

**A normal website deployment does not install this new recorder on anybody's phone.** Someone must first build and distribute the native application, and each walker must install it. The existing website and Home Screen installation remain available.

| Installation | How it reaches the phone | Recording with Home pressed or the screen locked |
| --- | --- | --- |
| Website or browser Home Screen app | Visit the website and use its install / Add to Home Screen option | Cannot provide reliable continuous background GPS; keep the recording screen open |
| Native iPhone app | Install a development build, a TestFlight beta or an App Store release | Uses iOS background location updates |
| Native Android app | Install an APK or a Play Store release | Uses an Android location foreground service with a recording notification |

An APK is an Android application installation file. TestFlight is Apple's way to distribute an iPhone app for testing before its App Store release. The new native app can have a similar icon to the browser app; how it was installed determines which one it is.

Browsers restrict location updates when a document is hidden. Installing a website on the Home Screen does not give it native background location access. See the [W3C geolocation specification](https://www.w3.org/TR/geolocation/#request-a-position).

## What you need to do next

For the first trial, a maintainer needs to prepare a build for the website you want to use, install it on an iPhone and an Android phone, and run the outdoor recording check below. Signing and public distribution are separate steps after that trial. The builds checked during development used a placeholder website address and are not ready to use against a real group website.

Walkers do not need Xcode, Android Studio or a development computer. Once a native build has been distributed, they install it from the supplied installation route, open it and sign in to the configured group website using their existing account.

The native application is a separate installation, so do not assume that the browser app's sign-in, unsaved recording or downloaded routes and maps will transfer. Saved routes on the website are accessed through the same group account. Download anything needed offline again inside the native app before walking.

## Prepare the native apps on a development computer

Use Node 24 and the repository's installed dependencies. iPhone builds require a Mac with Xcode 26 or later and its iOS platform installed. Android builds require Android Studio, Android SDK 36 and Java 21. The current projects support iOS 15 or later and Android 7 / API 24 or later; actual device behaviour still needs testing.

From the repository root:

```sh
MOBILE_SITE_URL="https://group.example.org.uk" npm run mobile:prepare
```

Replace the example with the HTTPS origin of the website that the phone app should connect to. Use the website address without a path or query string. This setting tells the native app where to sign in, load website data and save routes. It does not create or deploy that website.

The command builds the existing Angular frontend, puts a separate copy in `dist/ngx-mobile`, and copies that bundle into both native projects. The configured website address is kept in ignored build assets. There is currently one website per build, with no website picker. Both projects use the application identifier `org.ngxramblers.walking`; preparing another website does not create a separately installable app identity.

### Install on your own iPhone for testing

1. Run `npm run mobile:ios` to open the project in Xcode.
2. Connect the iPhone to the Mac, unlock it and accept any trust prompts.
3. Select the `App` target. In Signing & Capabilities, select your Apple development team and resolve any provisioning messages that Xcode shows.
4. Select the connected iPhone as the run destination, then use Run to build and install the application. Approve any device trust or Developer Mode prompts required by the phone.
5. Open the newly installed app and sign in. Allow precise location. The current recorder requests Always location access when available; accept that option when offered for the background recording trial.

Signing identifies the developer and allows the phone to accept the application. It is separate from signing in to the group website. A simulator build proves that the source compiles, but it cannot be installed on an iPhone as the finished application.

### Install on your own Android phone for testing

1. Run `npm run mobile:android` to open the project in Android Studio.
2. Connect the phone, enable its developer options and USB debugging, and approve the computer when prompted.
3. Select the `app` run configuration and the connected phone, then use Run to build and install it.
4. Open the newly installed app and sign in. Allow precise location and the recording notification when prompted.

Android Studio's device installation steps are described in [Build and run your app](https://developer.android.com/studio/run).

Alternatively, build a debug APK from the repository root:

```sh
mobile/android/gradlew -p mobile/android assembleDebug
```

The output is `mobile/android/app/build/outputs/apk/debug/app-debug.apk`. After `mobile:prepare` has been run with the intended website address, this file can be transferred to a test phone and installed there. Android may ask you to allow installation from the application opening the APK. This is a development build, not a Play Store release.

## Use it on a walk

1. Open the native app installed through Xcode, TestFlight, an APK or an app store.
2. Sign in and download any routes and maps needed offline.
3. Start a recording in the existing walking screens and wait until several GPS points appear.
4. Press Home, switch apps or lock the screen. The native recorder is designed to continue collecting and storing GPS points.
5. Return to the app. It reads the points recorded in the background and adds them to the route. Saving waits for those points to be recovered before uploading the route.
6. Use Pause when you intentionally want to stop recording temporarily. Resume starts collection again. Stop or leaving the route screen inside the walking app stops collection; pressing the phone's Home button is different from navigating away from the route inside the app.
7. Save and reopen the route as usual. The existing route accuracy checks, distance calculation, editing and GPX saving still apply.

The recording screen says that recording continues with the screen locked when the native recorder is available. If it says to keep the screen open, you are using the browser recording path.

## Distribute it to other walkers

For iPhone testing, create a signed archive in Xcode, upload it to App Store Connect and distribute it through TestFlight using an Apple Developer Program account. Testers install Apple's TestFlight application and accept the invitation to install the walking app. A public App Store release requires a separate submission and review. See [Apple's TestFlight guide](https://developer.apple.com/testflight/).

For Android, an APK can be supplied for a controlled device trial. Public Play Store distribution requires a signed release app bundle and a Play Console release. Keep signing credentials outside this repository and retain the release signing identity for future updates.

The native projects, source code and build commands exist. This session did not set up store listings, distribution accounts, release signing or an automatic native release workflow. These are the additional release tasks needed to make installation straightforward for members.

## How future updates work

The website continues to use its existing deployment process. Server changes and saved website data are available to the native app through its configured website.

The native app contains a bundled copy of the frontend screens and code. A change to those screens or the native recorder needs another `mobile:prepare`, a new native build and an installation update. Increase the native build numbers for distributed updates and use the same application identifier and signing identity. No automatic download of a newer Angular bundle from the website has been implemented.

The current GitHub website deployment workflows do not build, sign or distribute these native projects. A successful website deployment therefore does not prove that a new iPhone or Android version has reached users.

## Check on real phones before release

Run this check on an iPhone and an Android phone:

1. Allow precise location and any background location prompts. Allow Android's recording notification when prompted.
2. Start recording outdoors and walk until several points have appeared.
3. Press Home, walk for at least ten minutes and use another app during that period.
4. Return to the walking app. Check that the background section contains GPS points, with no straight join replacing the walked path.
5. Lock the screen and walk for another ten minutes. Return and repeat the check.
6. Pause, move, resume and verify that the deliberate pause remains a separate segment.
7. Save, reopen and edit the route, and compare the GPX export with the recorded points.
8. Repeat with no network after downloading the route and map. Recording must continue; if saving fails offline, reconnect and retry without losing the recording.
9. Remove location permission and verify that recording reports the failure. Restore permission and explicitly resume.

The operating system can stop collection if the user force-stops the application, removes location access or disables location services. Some Android phones impose additional battery restrictions. The intended behaviour is the same on both platforms, but passing a build and automated tests does not prove a real walking trace on every phone.

## Storage and developer checks

The native recorder writes GPS points to private phone storage before notifying the screen. These files are excluded from cloud device backup and are not uploaded by the native service. Saving uses the existing authenticated route API. Starting a replacement recording resets its native point file; uninstalling the application removes its private storage.

The native storage checks cover long background batches, incremental recovery, reopening files and replacing a recording:

```sh
mobile/android/gradlew -p mobile/android testDebugUnitTest
xcrun swiftc -parse-as-library mobile/ios/App/App/Recording/RoutePositionStore.swift mobile/tests/route-position-store.swift -o /tmp/route-position-store-check
/tmp/route-position-store-check
```

For the development history, verified results and remaining release work, see [the session handover](../non-vcs/session-handover-mobile-background-recording-2026-10-05.md).

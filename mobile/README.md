# Walking apps for iPhone and Android

These projects package the existing walking app with native GPS recording. There is no third-party location licence. Starting a recording enables iOS Always location or an Android location foreground service. Pressing Home, locking the screen or switching apps does not stop that service. Pause, Stop and leaving the route screen stop location collection.

The native recorder writes each GPS fix to private storage before notifying the web view. Returning to the app reads the fixes collected in the background in timestamp order, without restarting the native recorder. The existing route accuracy checks, gap handling, distance calculation and GPX saving apply to those points. The app's pages and code are bundled, so reopening does not need to download Angular again. Existing downloaded routes remain in the local route cache.

## Prepare both apps

Use Node 24, Xcode 26 or later with its iOS platform installed, and Android Studio with Android SDK 36 and Java 21. Install the repository dependencies first.

```sh
MOBILE_SITE_URL="https://group.example.org.uk" npm run mobile:prepare
```

Replace the example with the group website that this installation should use. The command builds the frontend, creates a separate mobile bundle and copies it into both native projects. The website origin is stored only in ignored build assets. Web deployments keep their ordinary relative API URLs.

```sh
npm run mobile:ios
npm run mobile:android
```

For iPhone, choose an Apple development team in Xcode, then build and run on the phone. Distribution to other phones needs a signed archive through TestFlight or the App Store. For Android, build an APK for device testing or a signed app bundle for Play Store distribution. Android requires API 24 or later; iOS requires version 15 or later. Signing credentials stay outside this repository.

The native app is a separate installation from Safari or Chrome's Add to Home Screen app. Publishing the website alone does not install native capabilities. A browser recording explains that its screen must stay open.

## Check native storage

The Android equivalent runs with `mobile/android/gradlew -p mobile/android testDebugUnitTest`.

The storage check exercises a long background batch, incremental recovery, reopening the file and replacing a recording:

```sh
xcrun swiftc -parse-as-library mobile/ios/App/App/Recording/RoutePositionStore.swift mobile/tests/route-position-store.swift -o /tmp/route-position-store-check
/tmp/route-position-store-check
```

## Check on real phones

Run this check on an iPhone and an Android phone before release:

1. Allow precise location, and allow Android's recording notification when prompted.
2. Start recording outdoors and walk until several points have appeared.
3. Press Home, walk for at least ten minutes and use another app during that period.
4. Return to the walking app. Check that the background section contains GPS points, with no straight join replacing the walked path.
5. Lock the screen and walk for another ten minutes. Return and repeat the check.
6. Pause, move, resume and verify the deliberate pause remains a separate segment.
7. Save, reopen and edit the route, and check the GPX export against the recorded points.
8. Repeat with no network after downloading the route and map. GPS recording must continue and saving should remain available for retry when the connection returns.
9. Remove location permission and verify recording reports the permission failure. Restore permission and explicitly resume.

The operating system can stop location collection if the user force-stops the app, removes location access or disables location services. Android manufacturers may impose additional battery restrictions. Those conditions require device testing; a simulator build cannot prove a real walking trace.

## Storage

GPS points are kept on the phone, excluded from cloud device backup, and are not uploaded by the native service. Saving uses the existing authenticated route API. Native raw point files remain available for resuming the current recording; starting a replacement recording resets its native point file. Uninstalling the app removes its private storage.

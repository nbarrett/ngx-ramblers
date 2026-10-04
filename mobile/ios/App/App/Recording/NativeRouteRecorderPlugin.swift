import Capacitor
import CoreLocation

@objc(NativeRouteRecorderPlugin)
public class NativeRouteRecorderPlugin: CAPPlugin, CAPBridgedPlugin, CLLocationManagerDelegate {
    public let identifier = "NativeRouteRecorderPlugin"
    public let jsName = "NativeRouteRecorder"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "positions", returnType: CAPPluginReturnPromise)
    ]
    private let locationManager = CLLocationManager()
    private var sessionId: String?
    private var pendingStart: CAPPluginCall?
    private var store: RoutePositionStore?
    private var storageError: Error?
    private var askedForAlways = false

    public override func load() {
        locationManager.delegate = self
        locationManager.desiredAccuracy = kCLLocationAccuracyBest
        locationManager.distanceFilter = 3
        locationManager.activityType = .fitness
        locationManager.pausesLocationUpdatesAutomatically = false
        locationManager.allowsBackgroundLocationUpdates = true
        locationManager.showsBackgroundLocationIndicator = true
        do {
            store = try RoutePositionStore()
        } catch {
            storageError = error
        }
    }

    @objc func start(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            if let id = call.getString("sessionId"), !id.isEmpty, let store = self.store {
                do {
                    if self.sessionId != id || call.getBool("reset") == true {
                        self.locationManager.stopUpdatingLocation()
                        try store.prepare(sessionId: id, reset: call.getBool("reset") ?? false)
                    }
                    self.sessionId = id
                    self.pendingStart?.reject("Location request was replaced", "unavailable")
                    self.pendingStart = call
                    self.beginWhenAuthorised()
                } catch {
                    call.reject("Could not prepare the recording: " + error.localizedDescription, "unavailable")
                }
            } else {
                call.reject(self.storageError?.localizedDescription ?? "A recording identifier is required", "unavailable")
            }
        }
    }

    @objc func stop(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.locationManager.stopUpdatingLocation()
            self.pendingStart?.reject("Location request was stopped", "unavailable")
            self.pendingStart = nil
            self.sessionId = nil
            call.resolve()
        }
    }

    @objc func positions(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            if let id = call.getString("sessionId"), let store = self.store {
                do {
                    call.resolve(["sessionId": id, "positions": try store.positions(sessionId: id, after: call.getDouble("after") ?? 0)])
                } catch {
                    call.reject("Could not read the recording: " + error.localizedDescription, "unavailable")
                }
            } else {
                call.reject("Recording storage is unavailable", "unavailable")
            }
        }
    }

    public func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        if pendingStart != nil {
            beginWhenAuthorised()
        } else if sessionId != nil && (manager.authorizationStatus == .denied || manager.authorizationStatus == .restricted) {
            manager.stopUpdatingLocation()
            notifyListeners("locationError", data: ["code": "permission-denied", "message": "Location permission was removed."])
        }
    }

    private func beginWhenAuthorised() {
        switch locationManager.authorizationStatus {
        case .notDetermined:
            askedForAlways = true
            locationManager.requestAlwaysAuthorization()
        case .authorizedWhenInUse:
            startIfPrecise()
            if !askedForAlways {
                askedForAlways = true
                locationManager.requestAlwaysAuthorization()
            }
        case .authorizedAlways:
            startIfPrecise()
        case .denied, .restricted:
            pendingStart?.reject("Allow location access to record a walking route.", "permission-denied")
            pendingStart = nil
        @unknown default:
            pendingStart?.reject("Location access is unavailable.", "unavailable")
            pendingStart = nil
        }
    }

    private func startIfPrecise() {
        if locationManager.accuracyAuthorization == .fullAccuracy {
            locationManager.startUpdatingLocation()
            pendingStart?.resolve()
            pendingStart = nil
        } else {
            pendingStart?.reject("Enable Precise Location to record a walking route.", "permission-denied")
            pendingStart = nil
        }
    }

    public func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        if let id = sessionId, let store = store {
            do {
                try locations.filter { $0.horizontalAccuracy >= 0 }.sorted { $0.timestamp < $1.timestamp }.forEach { location in
                    try store.append(sessionId: id, position: [
                        "latitude": location.coordinate.latitude,
                        "longitude": location.coordinate.longitude,
                        "accuracy": location.horizontalAccuracy,
                        "altitude": location.verticalAccuracy >= 0 ? location.altitude as Any : NSNull(),
                        "heading": location.course >= 0 ? location.course as Any : NSNull(),
                        "timestamp": location.timestamp.timeIntervalSince1970 * 1000
                    ])
                }
                notifyListeners("positions", data: [:])
            } catch {
                manager.stopUpdatingLocation()
                notifyListeners("locationError", data: ["code": "unavailable", "message": "Could not save GPS points: " + error.localizedDescription])
            }
        }
    }

    public func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        let denied = (error as? CLError)?.code == .denied
        notifyListeners("locationError", data: ["code": denied ? "permission-denied" : "unavailable", "message": error.localizedDescription])
    }
}

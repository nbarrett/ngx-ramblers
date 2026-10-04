import Capacitor

class WalkingBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(NativeRouteRecorderPlugin())
    }
}

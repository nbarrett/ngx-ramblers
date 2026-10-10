import Capacitor
import UIKit

class WalkingBridgeViewController: CAPBridgeViewController {
    override func viewDidLoad() {
        super.viewDidLoad()
        if let walkingWebView = webView {
            let container = UIView()
            container.backgroundColor = .systemBackground
            view = container
            walkingWebView.translatesAutoresizingMaskIntoConstraints = false
            container.addSubview(walkingWebView)
            NSLayoutConstraint.activate([
                walkingWebView.topAnchor.constraint(equalTo: container.safeAreaLayoutGuide.topAnchor),
                walkingWebView.bottomAnchor.constraint(equalTo: container.safeAreaLayoutGuide.bottomAnchor),
                walkingWebView.leadingAnchor.constraint(equalTo: container.safeAreaLayoutGuide.leadingAnchor),
                walkingWebView.trailingAnchor.constraint(equalTo: container.safeAreaLayoutGuide.trailingAnchor)
            ])
        }
    }

    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(NativeRouteRecorderPlugin())
    }
}

import Capacitor
import UIKit
import WebKit

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
        bridge?.registerPluginInstance(NativeSiteNavigationPlugin())
        NativeSiteNavigationPlugin.configure(webView)
    }
}

@objc(NativeSiteNavigationPlugin)
public class NativeSiteNavigationPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NativeSiteNavigationPlugin"
    public let jsName = "NativeSiteNavigation"
    public let pluginMethods: [CAPPluginMethod] = [CAPPluginMethod(name: "selectSite", returnType: CAPPluginReturnPromise)]

    static func configure(_ webView: WKWebView?) {
        let origin = UserDefaults.standard.string(forKey: "native-site-origin") ?? ""
        let encoded: String
        do {
            let buildNumber = Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? ""
            let data = try JSONSerialization.data(withJSONObject: ["origin": origin, "buildNumber": buildNumber])
            encoded = String(decoding: data, as: UTF8.self)
        } catch {
            NSLog("Could not initialise native site navigation: %@", error.localizedDescription)
            return
        }
        let source = "window.ngxNativeNavigationBoot=true;if(!localStorage.getItem(\"app-appearance\")){localStorage.setItem(\"app-appearance\",\"light\");}var app=" + encoded + ";window.ngxNativeBuildNumber=app.buildNumber;var selected=app.origin;if(location.protocol===\"capacitor:\"){localStorage.setItem(\"app-site-origin\",selected);}else if(location.origin===selected){window.ngxNativeSiteUrl=selected;localStorage.setItem(\"app-site-origin\",selected);}"
        if let controller = webView?.configuration.userContentController {
            let scripts = controller.userScripts.filter { !$0.source.hasPrefix("window.ngxNativeNavigationBoot=true;") }
            controller.removeAllUserScripts()
            scripts.forEach { controller.addUserScript($0) }
            controller.addUserScript(WKUserScript(source: source, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        }
    }

    @objc func selectSite(_ call: CAPPluginCall) {
        let origin = call.getString("origin") ?? ""
        if origin.isEmpty || (URL(string: origin)?.scheme == "https" && URL(string: origin)?.host != nil) {
            UserDefaults.standard.set(origin, forKey: "native-site-origin")
            DispatchQueue.main.async {
                Self.configure(self.bridge?.webView)
                call.resolve()
            }
        } else {
            call.reject("Choose a valid HTTPS website")
        }
    }

    public override func shouldOverrideLoad(_ navigationAction: WKNavigationAction) -> NSNumber? {
        if let url = navigationAction.request.url,
           let selected = UserDefaults.standard.string(forKey: "native-site-origin"),
           let origin = URL(string: selected),
           url.scheme == origin.scheme && url.host == origin.host && url.port == origin.port {
            return false
        } else {
            return nil
        }
    }
}

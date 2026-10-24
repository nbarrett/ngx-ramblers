package org.ngxramblers.walking;

import android.content.Intent;
import android.net.Uri;
import android.util.Log;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import androidx.webkit.ScriptHandler;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebViewClient;
import com.getcapacitor.JSExport;
import java.util.Collections;

public class SiteResourceWebViewClient extends BridgeWebViewClient {
    private final Bridge bridge;
    private ScriptHandler siteScript;
    private ScriptHandler shellScript;
    private String preparedOrigin;

    public SiteResourceWebViewClient(Bridge bridge) {
        super(bridge);
        this.bridge = bridge;
        refreshShellScript();
    }

    public void refreshShellScript() {
        if (WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
            if (shellScript != null) {
                shellScript.remove();
            }
            shellScript = WebViewCompat.addDocumentStartJavaScript(bridge.getWebView(), shellBootJavaScript(NativeSiteNavigationPlugin.selectedOrigin(bridge.getContext())), Collections.singleton(origin(Uri.parse(bridge.getLocalUrl()))));
        }
    }

    @Override
    public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
        Uri target = request.getUrl();
        String selected = NativeSiteNavigationPlugin.selectedOrigin(bridge.getContext());
        String origin = origin(target);
        if (origin.equals(selected) && !selected.isEmpty()) {
            if (origin.equals(preparedOrigin)) {
                return false;
            } else if (WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
                view.evaluateJavascript("JSON.stringify(window.Capacitor.PluginHeaders || [])", headers -> {
                    try {
                        String pluginHeaders = new org.json.JSONArray("[" + headers + "]").getString(0);
                        String boot = "window.WEBVIEW_SERVER_URL=" + org.json.JSONObject.quote(origin) + ";"
                            + JSExport.getGlobalJS(bridge.getContext(), false, false)
                            + JSExport.getBridgeJS(bridge.getContext())
                            + ";window.Capacitor.PluginHeaders=" + pluginHeaders + ";"
                            + nativeBootJavaScript(origin);
                        if (siteScript != null) {
                            siteScript.remove();
                        }
                        siteScript = WebViewCompat.addDocumentStartJavaScript(view, boot, Collections.singleton(origin));
                        preparedOrigin = origin;
                        view.loadUrl(target.toString());
                    } catch (Exception error) {
                        Log.e("NativeSiteNavigation", "Could not initialise the selected website", error);
                    }
                });
                return true;
            } else {
                Log.e("NativeSiteNavigation", "The Android System WebView must support document-start scripts");
                return true;
            }
        } else if (origin.equals(origin(Uri.parse(bridge.getLocalUrl())))) {
            if (request.isForMainFrame() && view.getUrl() != null && origin(Uri.parse(view.getUrl())).equals(selected)) {
                NativeSiteNavigationPlugin.storeOrigin(bridge.getContext(), "");
                refreshShellScript();
            }
            return false;
        } else {
            if (request.isForMainFrame()) {
                try {
                    bridge.getContext().startActivity(new Intent(Intent.ACTION_VIEW, target));
                } catch (android.content.ActivityNotFoundException error) {
                    Log.e("NativeSiteNavigation", "No application can open this link", error);
                }
            }
            return true;
        }
    }

    static String nativeBootJavaScript(String origin) {
        return nativeAppJavaScript() + "window.ngxNativeSiteUrl=" + org.json.JSONObject.quote(origin) + ";"
            + "localStorage.setItem(\"app-site-origin\"," + org.json.JSONObject.quote(origin) + ");";
    }

    static String shellBootJavaScript(String origin) {
        return nativeAppJavaScript() + "localStorage.setItem(\"app-site-origin\"," + org.json.JSONObject.quote(origin) + ");";
    }

    private static String nativeAppJavaScript() {
        return "window.ngxNativeBuildNumber=" + org.json.JSONObject.quote(Integer.toString(BuildConfig.VERSION_CODE)) + ";"
            + "if(!localStorage.getItem(\"app-appearance\")){localStorage.setItem(\"app-appearance\",\"light\");}";
    }

    private static String origin(Uri uri) {
        String origin = uri.getScheme() + "://" + uri.getHost();
        return uri.getPort() < 0 ? origin : origin + ":" + uri.getPort();
    }
}

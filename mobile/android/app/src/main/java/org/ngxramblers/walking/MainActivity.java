package org.ngxramblers.walking;

import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import org.ngxramblers.walking.compass.NativeCompassPlugin;
import org.ngxramblers.walking.recording.NativeRouteRecorderPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NativeRouteRecorderPlugin.class);
        registerPlugin(NativeCompassPlugin.class);
        super.onCreate(savedInstanceState);
        attachSiteClient();
        lockWebViewTextZoom();
    }

    @Override
    public void onStart() {
        super.onStart();
        attachSiteClient();
        lockWebViewTextZoom();
    }

    private void attachSiteClient() {
        if (this.bridge != null && this.bridge.getWebView() != null && !(this.bridge.getWebViewClient() instanceof SiteResourceWebViewClient)) {
            this.bridge.setWebViewClient(new SiteResourceWebViewClient(this.bridge));
        }
    }

    private void lockWebViewTextZoom() {
        if (this.bridge != null && this.bridge.getWebView() != null) {
            WebView webView = this.bridge.getWebView();
            WebSettings settings = webView.getSettings();
            settings.setTextZoom(100);
        }
    }
}

package org.ngxramblers.walking;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import org.ngxramblers.walking.recording.NativeRouteRecorderPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NativeRouteRecorderPlugin.class);
        super.onCreate(savedInstanceState);
        attachSiteClient();
    }

    @Override
    public void onStart() {
        super.onStart();
        attachSiteClient();
    }

    private void attachSiteClient() {
        if (this.bridge != null && this.bridge.getWebView() != null && !(this.bridge.getWebViewClient() instanceof SiteResourceWebViewClient)) {
            this.bridge.setWebViewClient(new SiteResourceWebViewClient(this.bridge));
        }
    }
}

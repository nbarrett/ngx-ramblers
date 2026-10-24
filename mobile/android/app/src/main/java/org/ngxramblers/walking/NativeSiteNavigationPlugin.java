package org.ngxramblers.walking;

import android.content.Context;
import android.net.Uri;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "NativeSiteNavigation")
public class NativeSiteNavigationPlugin extends Plugin {
    static String selectedOrigin(Context context) {
        return context.getSharedPreferences("native-site", Context.MODE_PRIVATE).getString("origin", "");
    }

    static void storeOrigin(Context context, String origin) {
        context.getSharedPreferences("native-site", Context.MODE_PRIVATE).edit().putString("origin", origin).apply();
    }

    @PluginMethod
    public void selectSite(PluginCall call) {
        String origin = call.getString("origin", "");
        Uri site = Uri.parse(origin);
        if (origin.isEmpty() || ("https".equals(site.getScheme()) && site.getHost() != null && site.getUserInfo() == null && site.getQuery() == null && site.getFragment() == null && (site.getPath() == null || site.getPath().isEmpty()))) {
            storeOrigin(getContext(), origin);
            getActivity().runOnUiThread(() -> {
                if (getBridge().getWebViewClient() instanceof SiteResourceWebViewClient) {
                    ((SiteResourceWebViewClient) getBridge().getWebViewClient()).refreshShellScript();
                }
                call.resolve();
            });
        } else {
            call.reject("Choose a valid HTTPS website");
        }
    }
}

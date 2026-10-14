package org.ngxramblers.walking;

import android.net.Uri;
import android.webkit.CookieManager;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebViewClient;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class SiteResourceWebViewClient extends BridgeWebViewClient {
    public SiteResourceWebViewClient(Bridge bridge) {
        super(bridge);
    }

    @Override
    public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
        Uri uri = request.getUrl();
        String host = uri == null ? null : uri.getHost();
        boolean remoteGet = "GET".equalsIgnoreCase(request.getMethod())
            && !request.isForMainFrame()
            && host != null
            && !"localhost".equalsIgnoreCase(host)
            && !"127.0.0.1".equals(host);
        if (remoteGet) {
            WebResourceResponse proxied = proxy(request);
            if (proxied != null) {
                return proxied;
            }
        }
        return super.shouldInterceptRequest(view, request);
    }

    private WebResourceResponse proxy(WebResourceRequest request) {
        HttpURLConnection connection = null;
        try {
            URL url = new URL(request.getUrl().toString());
            connection = (HttpURLConnection) url.openConnection();
            connection.setInstanceFollowRedirects(true);
            connection.setConnectTimeout(15000);
            connection.setReadTimeout(20000);
            connection.setRequestMethod("GET");
            Map<String, String> incoming = request.getRequestHeaders();
            if (incoming != null) {
                for (Map.Entry<String, String> header : incoming.entrySet()) {
                    String name = header.getKey();
                    if (name != null && header.getValue() != null && !skipHeader(name)) {
                        connection.setRequestProperty(name, header.getValue());
                    }
                }
            }
            String origin = url.getProtocol() + "://" + url.getHost();
            if (url.getPort() > 0 && url.getPort() != 80 && url.getPort() != 443) {
                origin = origin + ":" + url.getPort();
            }
            connection.setRequestProperty("Referer", origin + "/");
            connection.setRequestProperty("Origin", origin);
            String cookie = CookieManager.getInstance().getCookie(url.toString());
            if (cookie != null && !cookie.isEmpty()) {
                connection.setRequestProperty("Cookie", cookie);
            }
            int status = connection.getResponseCode();
            String contentType = connection.getContentType();
            String mime = "application/octet-stream";
            String encoding = null;
            if (contentType != null) {
                String[] parts = contentType.split(";");
                if (parts.length > 0 && !parts[0].trim().isEmpty()) {
                    mime = parts[0].trim();
                }
                for (int i = 1; i < parts.length; i++) {
                    String part = parts[i].trim();
                    if (part.toLowerCase().startsWith("charset=")) {
                        encoding = part.substring(8).trim();
                    }
                }
            }
            Map<String, String> headers = new HashMap<>();
            Map<String, List<String>> raw = connection.getHeaderFields();
            if (raw != null) {
                for (Map.Entry<String, List<String>> field : raw.entrySet()) {
                    if (field.getKey() != null && field.getValue() != null && !field.getValue().isEmpty()) {
                        headers.put(field.getKey(), field.getValue().get(0));
                    }
                }
            }
            InputStream stream = status >= 400 ? connection.getErrorStream() : connection.getInputStream();
            if (stream == null) {
                connection.disconnect();
                return null;
            }
            String reason = connection.getResponseMessage();
            return new WebResourceResponse(mime, encoding, status, reason == null ? "OK" : reason, headers, stream);
        } catch (Exception error) {
            if (connection != null) {
                connection.disconnect();
            }
            return null;
        }
    }

    private boolean skipHeader(String name) {
        String key = name.toLowerCase();
        return key.equals("host") || key.equals("referer") || key.equals("origin") || key.equals("cookie");
    }
}

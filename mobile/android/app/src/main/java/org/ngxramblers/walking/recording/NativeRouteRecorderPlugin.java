package org.ngxramblers.walking.recording;

import android.Manifest;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Build;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

@CapacitorPlugin(name = "NativeRouteRecorder", permissions = {
    @Permission(alias = "location", strings = {Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION}),
    @Permission(alias = "notifications", strings = {Manifest.permission.POST_NOTIFICATIONS})
})
public class NativeRouteRecorderPlugin extends Plugin {
    private BroadcastReceiver receiver;
    private RoutePositionStore store;

    @Override
    public void load() {
        receiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                if (RouteRecordingService.POSITIONS_ACTION.equals(intent.getAction())) {
                    notifyListeners("positions", new JSObject());
                } else {
                    JSObject failure = new JSObject();
                    failure.put("code", intent.getStringExtra("code"));
                    failure.put("message", intent.getStringExtra("message"));
                    notifyListeners("locationError", failure);
                }
            }
        };
        IntentFilter filter = new IntentFilter(RouteRecordingService.POSITIONS_ACTION);
        filter.addAction(RouteRecordingService.ERROR_ACTION);
        ContextCompat.registerReceiver(getContext(), receiver, filter, ContextCompat.RECEIVER_NOT_EXPORTED);
    }

    @PluginMethod
    public void start(PluginCall call) {
        if (call.getString("sessionId", "").isEmpty()) {
            call.reject("A recording identifier is required", "unavailable");
        } else if (getPermissionState("location") != PermissionState.GRANTED) {
            requestPermissionForAlias("location", call, "locationPermissionResult");
        } else {
            requestNotificationOrStart(call);
        }
    }

    @PermissionCallback
    private void locationPermissionResult(PluginCall call) {
        if (getPermissionState("location") == PermissionState.GRANTED) {
            requestNotificationOrStart(call);
        } else {
            call.reject("Enable precise location to record a walking route.", "permission-denied");
        }
    }

    private void requestNotificationOrStart(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 33 && getPermissionState("notifications") == PermissionState.PROMPT) {
            requestPermissionForAlias("notifications", call, "notificationPermissionResult");
        } else {
            beginRecording(call);
        }
    }

    @PermissionCallback
    private void notificationPermissionResult(PluginCall call) {
        beginRecording(call);
    }

    private void beginRecording(PluginCall call) {
        try {
            store = new RoutePositionStore(getContext());
            store.prepare(call.getString("sessionId"), call.getBoolean("reset", false));
            Intent intent = new Intent(getContext(), RouteRecordingService.class)
                .putExtra("sessionId", call.getString("sessionId"))
                .putExtra("reset", false);
            ContextCompat.startForegroundService(getContext(), intent);
            call.resolve();
        } catch (Exception error) {
            call.reject("Could not start location recording: " + error.getMessage(), "unavailable", error);
        }
    }

    @PluginMethod
    public void stop(PluginCall call) {
        getContext().stopService(new Intent(getContext(), RouteRecordingService.class));
        call.resolve();
    }

    @PluginMethod
    public void positions(PluginCall call) {
        try {
            String sessionId = call.getString("sessionId", "");
            if (store == null || call.getDouble("after", 0.0) == 0) {
                store = new RoutePositionStore(getContext());
            }
            JSObject batch = new JSObject();
            batch.put("sessionId", sessionId);
            batch.put("positions", store.positions(sessionId, call.getDouble("after", 0.0)));
            call.resolve(batch);
        } catch (Exception error) {
            call.reject("Could not read the recording: " + error.getMessage(), "unavailable", error);
        }
    }

    @Override
    protected void handleOnDestroy() {
        getContext().unregisterReceiver(receiver);
    }
}

package org.ngxramblers.walking.recording;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.Bundle;
import android.os.IBinder;
import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;
import androidx.core.content.ContextCompat;
import org.ngxramblers.walking.MainActivity;
import org.ngxramblers.walking.R;

public class RouteRecordingService extends Service implements LocationListener {
    static final String POSITIONS_ACTION = "org.ngxramblers.walking.POSITIONS";
    static final String ERROR_ACTION = "org.ngxramblers.walking.LOCATION_ERROR";
    private static final String CHANNEL = "walking-route-recording";
    private static final int NOTIFICATION_ID = 151;
    private LocationManager locations;
    private RoutePositionStore store;
    private String sessionId;

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && intent.getStringExtra("sessionId") != null) {
            try {
                startForegroundRecording();
                if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
                    fail("permission-denied", "Enable precise location to record a walking route.");
                } else {
                    String requestedSession = intent.getStringExtra("sessionId");
                    if (!requestedSession.equals(sessionId) || intent.getBooleanExtra("reset", false)) {
                        if (locations != null) {
                            locations.removeUpdates(this);
                        }
                        store = new RoutePositionStore(this);
                        store.prepare(requestedSession, intent.getBooleanExtra("reset", false));
                        sessionId = requestedSession;
                        locations = (LocationManager) getSystemService(LOCATION_SERVICE);
                        String provider = locations.isProviderEnabled(LocationManager.GPS_PROVIDER)
                            ? LocationManager.GPS_PROVIDER : LocationManager.NETWORK_PROVIDER;
                        if (locations.isProviderEnabled(provider)) {
                            locations.requestLocationUpdates(provider, 1000, 3, this);
                        } else {
                            fail("unavailable", "Turn on location services to record a walking route.");
                        }
                    }
                }
            } catch (Exception error) {
                fail(error instanceof SecurityException ? "permission-denied" : "unavailable", error.getMessage());
            }
        } else {
            stopSelf();
        }
        return START_NOT_STICKY;
    }

    private void startForegroundRecording() {
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (Build.VERSION.SDK_INT >= 26) {
            manager.createNotificationChannel(new NotificationChannel(CHANNEL, "Walking route recording", NotificationManager.IMPORTANCE_LOW));
        }
        PendingIntent openApp = PendingIntent.getActivity(this, 0, new Intent(this, MainActivity.class), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification notification = new NotificationCompat.Builder(this, CHANNEL)
            .setSmallIcon(R.drawable.ic_route_recording)
            .setContentTitle("Recording your walking route")
            .setContentText("Recording continues while the screen is locked or you use another app.")
            .setContentIntent(openApp)
            .setOngoing(true)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .build();
        ServiceCompat.startForeground(this, NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
    }

    @Override
    public void onLocationChanged(Location location) {
        if (sessionId != null && location.hasAccuracy()) {
            try {
                store.append(sessionId, location);
                sendBroadcast(new Intent(POSITIONS_ACTION).setPackage(getPackageName()));
            } catch (Exception error) {
                fail("unavailable", "Could not save GPS points: " + error.getMessage());
            }
        }
    }

    @Override
    public void onProviderDisabled(String provider) {
        sendBroadcast(new Intent(ERROR_ACTION).setPackage(getPackageName()).putExtra("code", "unavailable").putExtra("message", "Location services are unavailable."));
    }

    @Override
    public void onProviderEnabled(String provider) {}

    @Override
    public void onStatusChanged(String provider, int status, Bundle extras) {}

    @Override
    public void onDestroy() {
        if (locations != null) {
            locations.removeUpdates(this);
        }
        stopForeground(STOP_FOREGROUND_REMOVE);
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private void fail(String code, String message) {
        sendBroadcast(new Intent(ERROR_ACTION).setPackage(getPackageName()).putExtra("code", code).putExtra("message", message));
        stopSelf();
    }
}

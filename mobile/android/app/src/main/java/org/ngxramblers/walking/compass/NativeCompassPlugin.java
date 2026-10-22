package org.ngxramblers.walking.compass;

import android.content.Context;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.util.Log;
import android.view.Surface;
import android.view.WindowManager;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "NativeCompass")
public class NativeCompassPlugin extends Plugin implements SensorEventListener {
    private static final String TAG = "NativeCompass";
    private static final int SENSOR_INTERVAL_MICROS = 80000;
    private static final long PUBLISH_INTERVAL_MS = 80;
    private SensorManager sensorManager;
    private Sensor rotationSensor;
    private Sensor magneticSensor;
    private int rotationAccuracy = -1;
    private int magneticAccuracy = -1;
    private boolean listening;
    private long lastPublishMs;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final float[] rotationMatrix = new float[9];
    private final float[] remappedMatrix = new float[9];

    @Override
    public void load() {
        sensorManager = (SensorManager) getContext().getSystemService(Context.SENSOR_SERVICE);
        if (sensorManager != null) {
            magneticSensor = sensorManager.getDefaultSensor(Sensor.TYPE_MAGNETIC_FIELD);
            rotationSensor = sensorManager.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR);
            if (rotationSensor == null) {
                rotationSensor = sensorManager.getDefaultSensor(Sensor.TYPE_GEOMAGNETIC_ROTATION_VECTOR);
            }
        }
    }

    @PluginMethod
    public void start(PluginCall call) {
        if (sensorManager == null || rotationSensor == null) {
            call.reject("No rotation sensor is available", "unavailable");
        } else {
            if (!listening) {
                rotationAccuracy = -1;
                magneticAccuracy = -1;
                listening = sensorManager.registerListener(this, rotationSensor, SENSOR_INTERVAL_MICROS, mainHandler);
                if (listening && magneticSensor != null) {
                    sensorManager.registerListener(this, magneticSensor, SensorManager.SENSOR_DELAY_NORMAL, mainHandler);
                }
            }
            if (listening) {
                Log.i(TAG, "started");
                call.resolve();
            } else {
                Log.e(TAG, "registerListener failed");
                call.reject("The compass sensor could not be started", "unavailable");
            }
        }
    }

    @PluginMethod
    public void stop(PluginCall call) {
        stopListening();
        call.resolve();
    }

    @Override
    protected void handleOnDestroy() {
        stopListening();
        super.handleOnDestroy();
    }

    @Override
    public void onSensorChanged(SensorEvent event) {
        onAccuracyChanged(event.sensor, event.accuracy);
        long now = SystemClock.elapsedRealtime();
        if (event.sensor != rotationSensor || now - lastPublishMs < PUBLISH_INTERVAL_MS) {
            return;
        } else {
            lastPublishMs = now;
            SensorManager.getRotationMatrixFromVector(rotationMatrix, event.values);
            int displayRotation = displayRotation();
            int axisX = SensorManager.AXIS_X;
            int axisY = SensorManager.AXIS_Y;
            if (displayRotation == Surface.ROTATION_90) {
                axisX = SensorManager.AXIS_Y;
                axisY = SensorManager.AXIS_MINUS_X;
            } else if (displayRotation == Surface.ROTATION_180) {
                axisX = SensorManager.AXIS_MINUS_X;
                axisY = SensorManager.AXIS_MINUS_Y;
            } else if (displayRotation == Surface.ROTATION_270) {
                axisX = SensorManager.AXIS_MINUS_Y;
                axisY = SensorManager.AXIS_X;
            }
            SensorManager.remapCoordinateSystem(rotationMatrix, axisX, axisY, remappedMatrix);
            float screenEast = remappedMatrix[1];
            float screenNorth = remappedMatrix[4];
            float screenUp = remappedMatrix[7];
            float screenHoriz = (float) Math.hypot(screenEast, screenNorth);
            float facingEast = -remappedMatrix[2];
            float facingNorth = -remappedMatrix[5];
            float east;
            float north;
            if (Math.abs(screenUp) > screenHoriz) {
                east = facingEast;
                north = facingNorth;
            } else {
                east = screenEast;
                north = screenNorth;
            }
            double heading = (Math.toDegrees(Math.atan2(east, north)) + 360.0) % 360.0;
            JSObject payload = new JSObject();
            payload.put("heading", heading);
            payload.put("calibrationRecommended", needsCalibration(rotationAccuracy) || needsCalibration(magneticAccuracy));
            notifyListeners("heading", payload);
        }
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) {
        if (sensor == rotationSensor) {
            rotationAccuracy = accuracy;
        } else if (sensor == magneticSensor) {
            magneticAccuracy = accuracy;
        }
    }

    private boolean needsCalibration(int accuracy) {
        return accuracy == SensorManager.SENSOR_STATUS_UNRELIABLE || accuracy == SensorManager.SENSOR_STATUS_ACCURACY_LOW;
    }

    private int displayRotation() {
        WindowManager windowManager = (WindowManager) getContext().getSystemService(Context.WINDOW_SERVICE);
        if (windowManager == null || windowManager.getDefaultDisplay() == null) {
            return Surface.ROTATION_0;
        } else {
            return windowManager.getDefaultDisplay().getRotation();
        }
    }

    private void stopListening() {
        if (listening && sensorManager != null) {
            sensorManager.unregisterListener(this);
            listening = false;
        }
    }
}

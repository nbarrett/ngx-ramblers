package org.ngxramblers.walking;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import org.ngxramblers.walking.recording.NativeRouteRecorderPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NativeRouteRecorderPlugin.class);
        super.onCreate(savedInstanceState);
    }
}

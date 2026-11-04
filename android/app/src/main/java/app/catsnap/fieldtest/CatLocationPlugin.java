package app.catsnap.fieldtest;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.location.GnssStatus;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Looper;
import android.provider.Settings;

import androidx.annotation.NonNull;
import androidx.core.location.LocationManagerCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.util.HashMap;
import java.util.Map;

/**
 * Location straight from Android's LocationManager (satellite GPS + Wi-Fi/cell
 * network). Unlike Google's fused location it doesn't depend on Google Play
 * services or Google's servers, so it also works where those are unavailable.
 */
@CapacitorPlugin(
    name = "CatLocation",
    permissions = {
        @Permission(alias = "location", strings = { Manifest.permission.ACCESS_COARSE_LOCATION, Manifest.permission.ACCESS_FINE_LOCATION })
    }
)
public class CatLocationPlugin extends Plugin {
    private LocationManager lm;
    private final Map<String, LocationListener> listeners = new HashMap<>();
    private final Map<String, PluginCall> watches = new HashMap<>();

    // Satellite status, so the app can show "8 seen, 0 locked" while GPS acquires.
    private int satellitesInView = 0;
    private int satellitesUsed = 0;
    private long gnssAt = 0;
    private Object gnssCallback = null;

    private void startGnss() {
        if (gnssCallback != null || Build.VERSION.SDK_INT < Build.VERSION_CODES.N) return;
        try {
            GnssStatus.Callback cb = new GnssStatus.Callback() {
                @Override public void onSatelliteStatusChanged(@NonNull GnssStatus status) {
                    int used = 0;
                    for (int i = 0; i < status.getSatelliteCount(); i++) if (status.usedInFix(i)) used++;
                    satellitesInView = status.getSatelliteCount();
                    satellitesUsed = used;
                    gnssAt = System.currentTimeMillis();
                }
            };
            lm.registerGnssStatusCallback(cb, new android.os.Handler(Looper.getMainLooper()));
            gnssCallback = cb;
        } catch (SecurityException | IllegalArgumentException ignored) { }
    }

    private void stopGnss() {
        if (gnssCallback != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            try { lm.unregisterGnssStatusCallback((GnssStatus.Callback) gnssCallback); } catch (Exception ignored) { }
        }
        gnssCallback = null;
    }

    @Override
    public void load() {
        lm = (LocationManager) getContext().getSystemService(Context.LOCATION_SERVICE);
    }

    private boolean locationOn() {
        return lm != null && LocationManagerCompat.isLocationEnabled(lm);
    }

    private boolean providerOn(String p) {
        try { return lm != null && lm.isProviderEnabled(p); } catch (Exception e) { return false; }
    }

    private JSObject statusObject() {
        JSObject r = new JSObject();
        PermissionState ps = getPermissionState("location");
        r.put("permission", ps == null ? "prompt" : ps.toString());
        r.put("enabled", locationOn());
        r.put("gps", providerOn(LocationManager.GPS_PROVIDER));
        r.put("network", providerOn(LocationManager.NETWORK_PROVIDER));
        r.put("satellites", satellitesInView);
        r.put("satellitesUsed", satellitesUsed);
        r.put("gnssAgeMs", gnssAt == 0 ? -1 : System.currentTimeMillis() - gnssAt);
        return r;
    }

    @PluginMethod
    public void status(PluginCall call) { call.resolve(statusObject()); }

    @PluginMethod
    public void request(PluginCall call) {
        if (getPermissionState("location") == PermissionState.GRANTED) { call.resolve(statusObject()); return; }
        requestPermissionForAlias("location", call, "permissionResult");
    }

    @PermissionCallback
    private void permissionResult(PluginCall call) { call.resolve(statusObject()); }

    private JSObject fix(Location l, boolean cached) {
        JSObject o = new JSObject();
        o.put("lat", l.getLatitude());
        o.put("lng", l.getLongitude());
        o.put("accuracy", l.hasAccuracy() ? l.getAccuracy() : 9999);
        o.put("time", l.getTime());
        o.put("provider", l.getProvider());
        o.put("cached", cached);
        return o;
    }

    @PluginMethod(returnType = PluginMethod.RETURN_CALLBACK)
    public void watch(PluginCall call) {
        if (getPermissionState("location") != PermissionState.GRANTED) {
            call.reject("Location permission denied", "DENIED");
            return;
        }
        call.setKeepAlive(true);
        final String id = call.getCallbackId();

        // Start with the newest position the phone already knows about.
        Location best = null;
        for (String p : new String[] { LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER, LocationManager.PASSIVE_PROVIDER }) {
            try {
                Location l = lm.getLastKnownLocation(p);
                if (l != null && (best == null || l.getTime() > best.getTime())) best = l;
            } catch (SecurityException | IllegalArgumentException ignored) { }
        }
        if (best != null) call.resolve(fix(best, true));
        if (!locationOn()) {
            JSObject off = new JSObject();
            off.put("off", true);
            call.resolve(off);
        }

        LocationListener listener = new LocationListener() {
            @Override public void onLocationChanged(@NonNull Location l) { call.resolve(fix(l, false)); }
            @Override public void onProviderEnabled(@NonNull String p) {
                JSObject o = new JSObject(); o.put("searching", true); call.resolve(o);
            }
            @Override public void onProviderDisabled(@NonNull String p) {
                if (!locationOn()) { JSObject o = new JSObject(); o.put("off", true); call.resolve(o); }
            }
            @Override public void onStatusChanged(String p, int s, Bundle b) { }
        };
        int started = 0;
        for (String p : new String[] { LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER }) {
            try {
                if (lm.getAllProviders().contains(p)) {
                    lm.requestLocationUpdates(p, 1000L, 0f, listener, Looper.getMainLooper());
                    started++;
                }
            } catch (SecurityException | IllegalArgumentException ignored) { }
        }
        if (started == 0) {
            call.setKeepAlive(false);
            call.reject("No location providers on this device", "UNAVAILABLE");
            return;
        }
        listeners.put(id, listener);
        watches.put(id, call);
        startGnss();
    }

    @PluginMethod
    public void clearWatch(PluginCall call) {
        String id = call.getString("id");
        if (id != null) stopWatch(id);
        call.resolve();
    }

    private void stopWatch(String id) {
        LocationListener l = listeners.remove(id);
        if (l != null) lm.removeUpdates(l);
        PluginCall c = watches.remove(id);
        if (c != null) bridge.releaseCall(c);
        if (listeners.isEmpty()) stopGnss();
    }

    @PluginMethod
    public void openLocationSettings(PluginCall call) {
        Intent i = new Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(i);
        call.resolve();
    }

    @PluginMethod
    public void openAppSettings(PluginCall call) {
        Intent i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", getContext().getPackageName(), null));
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(i);
        call.resolve();
    }

    @Override
    protected void handleOnDestroy() {
        for (String id : listeners.keySet().toArray(new String[0])) stopWatch(id);
    }
}

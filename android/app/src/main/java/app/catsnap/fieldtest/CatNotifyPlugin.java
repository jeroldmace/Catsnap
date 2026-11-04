package app.catsnap.fieldtest;

import android.Manifest;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;

import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.ExistingWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.OneTimeWorkRequest;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.util.concurrent.TimeUnit;

/** Configures the background NotifyWorker and the notification permission. */
@CapacitorPlugin(
    name = "CatNotify",
    permissions = { @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS }) }
)
public class CatNotifyPlugin extends Plugin {
    private static final String WORK = "catsnap-notify";

    private SharedPreferences prefs() { return getContext().getSharedPreferences(NotifyWorker.PREFS, Context.MODE_PRIVATE); }

    private String permissionState() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return "granted";
        PermissionState s = getPermissionState("notifications");
        return s == null ? "prompt" : s.toString();
    }

    @PluginMethod
    public void permission(PluginCall call) {
        if (permissionState().equals("granted")) { JSObject r = new JSObject(); r.put("state", "granted"); call.resolve(r); return; }
        requestPermissionForAlias("notifications", call, "permissionDone");
    }

    @PermissionCallback
    private void permissionDone(PluginCall call) { JSObject r = new JSObject(); r.put("state", permissionState()); call.resolve(r); }

    /** { key, url, apikey, kinds: {like, comment, sighting, nearby}, nearbyKm } */
    @PluginMethod
    public void configure(PluginCall call) {
        String key = call.getString("key"), url = call.getString("url");
        if (key == null || url == null) { call.reject("key and url are required"); return; }
        JSObject kinds = call.getObject("kinds", new JSObject());
        SharedPreferences.Editor e = prefs().edit()
            .putString("key", key).putString("url", url).putString("apikey", call.getString("apikey"))
            .putBoolean("enabled", true)
            .putBoolean("kind_like", kinds.optBoolean("like", true))
            .putBoolean("kind_comment", kinds.optBoolean("comment", true))
            .putBoolean("kind_sighting", kinds.optBoolean("sighting", true))
            .putBoolean("kind_nearby", kinds.optBoolean("nearby", true))
            .putFloat("nearby_km", call.getFloat("nearbyKm", 3f));
        if (!prefs().contains("since")) e.putString("since", call.getString("since"));
        if (call.getData().has("cursor")) e.putLong("cursor", call.getData().optLong("cursor", 0));
        e.apply();

        Constraints net = new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build();
        PeriodicWorkRequest periodic = new PeriodicWorkRequest.Builder(NotifyWorker.class, 15, TimeUnit.MINUTES).setConstraints(net).build();
        WorkManager.getInstance(getContext()).enqueueUniquePeriodicWork(WORK, ExistingPeriodicWorkPolicy.UPDATE, periodic);
        call.resolve();
    }

    /** The last position, kept on the phone only, for "new cats near you". */
    @PluginMethod
    public void setPosition(PluginCall call) {
        Double lat = call.getDouble("lat"), lng = call.getDouble("lng");
        if (lat == null || lng == null) { call.reject("lat and lng are required"); return; }
        prefs().edit().putLong("lat", Double.doubleToRawLongBits(lat)).putLong("lng", Double.doubleToRawLongBits(lng)).apply();
        call.resolve();
    }

    /** Remember what the app already showed, so the background job doesn't repeat it. */
    @PluginMethod
    public void markSeen(PluginCall call) {
        SharedPreferences.Editor e = prefs().edit();
        if (call.getData().has("cursor")) e.putLong("cursor", Math.max(prefs().getLong("cursor", 0), call.getData().optLong("cursor", 0)));
        if (call.getString("since") != null) e.putString("since", call.getString("since"));
        e.apply();
        call.resolve();
    }

    @PluginMethod
    public void checkNow(PluginCall call) {
        OneTimeWorkRequest once = new OneTimeWorkRequest.Builder(NotifyWorker.class).build();
        WorkManager.getInstance(getContext()).enqueueUniqueWork(WORK + "-now", ExistingWorkPolicy.REPLACE, once);
        call.resolve();
    }

    @PluginMethod
    public void disable(PluginCall call) {
        WorkManager.getInstance(getContext()).cancelUniqueWork(WORK);
        prefs().edit().clear().apply();
        call.resolve();
    }

    @PluginMethod
    public void status(PluginCall call) {
        JSObject r = new JSObject();
        r.put("permission", permissionState());
        r.put("enabled", prefs().getBoolean("enabled", false));
        call.resolve(r);
    }
}

package app.catsnap.fieldtest;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

/**
 * Background check (every ~15 min): asks the notify-poll function for new
 * activity on your cats and recently shared cats, then decides "near you" on
 * the phone using the last position the app saved here. Your location is never sent.
 */
public class NotifyWorker extends Worker {
    static final String PREFS = "catsnap_notify";
    static final String CHANNEL = "activity";

    public NotifyWorker(@NonNull Context c, @NonNull WorkerParameters p) { super(c, p); }

    @NonNull
    @Override
    public Result doWork() {
        Context ctx = getApplicationContext();
        SharedPreferences sp = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String key = sp.getString("key", null);
        String url = sp.getString("url", null);
        if (key == null || url == null || !sp.getBoolean("enabled", false)) return Result.success();
        try {
            JSONObject req = new JSONObject();
            req.put("cursor", sp.getLong("cursor", 0));
            String since = sp.getString("since", null);
            if (since != null) req.put("since", since);

            HttpURLConnection con = (HttpURLConnection) new URL(url + "/functions/v1/notify-poll").openConnection();
            con.setRequestMethod("POST");
            con.setConnectTimeout(15000);
            con.setReadTimeout(20000);
            con.setDoOutput(true);
            con.setRequestProperty("Content-Type", "application/json");
            con.setRequestProperty("x-device-key", key);
            String apikey = sp.getString("apikey", null);
            if (apikey != null) con.setRequestProperty("apikey", apikey);
            try (OutputStream os = con.getOutputStream()) { os.write(req.toString().getBytes(StandardCharsets.UTF_8)); }
            int code = con.getResponseCode();
            if (code == 403) { sp.edit().putBoolean("enabled", false).apply(); return Result.success(); }  // device key revoked
            if (code != 200) return Result.retry();
            String body;
            try (InputStream in = con.getInputStream()) { body = new String(readAll(in), StandardCharsets.UTF_8); }
            JSONObject res = new JSONObject(body);

            ensureChannel(ctx);
            List<String> lines = new ArrayList<>();
            long cursor = sp.getLong("cursor", 0);
            JSONArray notes = res.optJSONArray("notifications");
            if (notes != null) for (int i = 0; i < notes.length(); i++) {
                JSONObject n = notes.getJSONObject(i);
                cursor = Math.max(cursor, n.optLong("id"));
                String kind = n.optString("kind");
                if (!sp.getBoolean("kind_" + kind, true)) continue;
                String who = n.optString("actor", "Someone"), cat = n.optString("snap_name", "your cat");
                lines.add(kind.equals("like") ? who + " liked " + cat
                    : kind.equals("comment") ? who + " commented on " + cat
                    : who + " spotted " + cat + " again");
            }
            JSONArray near = res.optJSONArray("nearby");
            boolean hasPos = sp.contains("lat") && sp.contains("lng");
            if (near != null && hasPos && sp.getBoolean("kind_nearby", true)) {
                double lat = Double.longBitsToDouble(sp.getLong("lat", 0)), lng = Double.longBitsToDouble(sp.getLong("lng", 0));
                double km = sp.getFloat("nearby_km", 3f);
                for (int i = 0; i < near.length(); i++) {
                    JSONObject s = near.getJSONObject(i);
                    double d = distanceKm(lat, lng, s.optDouble("lat"), s.optDouble("lng"));
                    if (d <= km) lines.add("New cat near you: " + s.optString("name", "a cat") + " (" + (d < 1 ? Math.round(d * 100) * 10 + " m" : String.format(java.util.Locale.US, "%.1f km", d)) + ")");
                }
            }
            sp.edit().putLong("cursor", cursor).putString("since", res.optString("now", since)).apply();
            if (!lines.isEmpty()) post(ctx, lines);
            return Result.success();
        } catch (Exception e) {
            return Result.retry();
        }
    }

    private static void ensureChannel(Context ctx) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel ch = new NotificationChannel(CHANNEL, "Cat activity", NotificationManager.IMPORTANCE_DEFAULT);
            ch.setDescription("Likes, comments and sightings on your cats, and new cats near you");
            ctx.getSystemService(NotificationManager.class).createNotificationChannel(ch);
        }
    }

    private static void post(Context ctx, List<String> lines) {
        Intent open = new Intent(ctx, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP)
            .putExtra("openActivity", true);
        PendingIntent pi = PendingIntent.getActivity(ctx, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        NotificationCompat.Builder b = new NotificationCompat.Builder(ctx, CHANNEL)
            .setSmallIcon(R.mipmap.ic_launcher_foreground)
            .setContentIntent(pi)
            .setAutoCancel(true);
        if (lines.size() == 1) {
            b.setContentTitle("Cat Snap").setContentText(lines.get(0));
        } else {
            NotificationCompat.InboxStyle style = new NotificationCompat.InboxStyle();
            for (String l : lines.subList(0, Math.min(lines.size(), 6))) style.addLine(l);
            if (lines.size() > 6) style.setSummaryText("+" + (lines.size() - 6) + " more");
            b.setContentTitle(lines.size() + " new in Cat Snap").setContentText(lines.get(0)).setStyle(style);
        }
        try { NotificationManagerCompat.from(ctx).notify((int) (System.currentTimeMillis() % Integer.MAX_VALUE), b.build()); }
        catch (SecurityException ignored) { /* notification permission not granted */ }
    }

    static double distanceKm(double la1, double lo1, double la2, double lo2) {
        double r = 6371, dLa = Math.toRadians(la2 - la1), dLo = Math.toRadians(lo2 - lo1);
        double h = Math.pow(Math.sin(dLa / 2), 2) + Math.cos(Math.toRadians(la1)) * Math.cos(Math.toRadians(la2)) * Math.pow(Math.sin(dLo / 2), 2);
        return 2 * r * Math.asin(Math.sqrt(h));
    }

    private static byte[] readAll(InputStream in) throws Exception {
        java.io.ByteArrayOutputStream bo = new java.io.ByteArrayOutputStream();
        byte[] buf = new byte[8192]; int n;
        while ((n = in.read(buf)) > 0) bo.write(buf, 0, n);
        return bo.toByteArray();
    }
}

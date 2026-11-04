package app.catsnap.fieldtest;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.media.ExifInterface;
import android.net.Uri;
import android.os.Build;
import android.provider.MediaStore;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;

/**
 * Pick a photo from the gallery with its original metadata, so the app can
 * read where it was taken. Since Android 10 photo locations are removed unless
 * the app holds ACCESS_MEDIA_LOCATION and asks for the original file.
 * The location is only read on the phone; uploads are re-encoded without metadata.
 */
@CapacitorPlugin(
    name = "CatPhoto",
    permissions = { @Permission(alias = "mediaLocation", strings = { Manifest.permission.ACCESS_MEDIA_LOCATION }) }
)
public class CatPhotoPlugin extends Plugin {

    @PluginMethod
    public void pick(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && getPermissionState("mediaLocation") != PermissionState.GRANTED) {
            requestPermissionForAlias("mediaLocation", call, "afterPermission");
            return;
        }
        open(call);
    }

    @PermissionCallback
    private void afterPermission(PluginCall call) { open(call); }   // continue even if denied (photo without location)

    private void open(PluginCall call) {
        Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        i.addCategory(Intent.CATEGORY_OPENABLE);
        i.setType("image/*");
        startActivityForResult(call, i, "picked");
    }

    @ActivityCallback
    private void picked(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null || result.getData().getData() == null) {
            call.reject("Cancelled", "CANCELLED");
            return;
        }
        Uri uri = result.getData().getData();
        boolean original = false;
        File out = new File(getContext().getCacheDir(), "picked-" + System.currentTimeMillis());
        try {
            boolean copied = false;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && getPermissionState("mediaLocation") == PermissionState.GRANTED) {
                try {
                    Uri media = MediaStore.getMediaUri(getContext(), uri);
                    if (media != null) {
                        copy(MediaStore.setRequireOriginal(media), out);
                        copied = true;
                        original = true;
                    }
                } catch (Exception ignored) { /* fall back to the picked copy */ }
            }
            if (!copied) copy(uri, out);

            JSObject r = new JSObject();
            r.put("path", out.getAbsolutePath());
            r.put("mime", getContext().getContentResolver().getType(uri));
            r.put("original", original);
            try {
                ExifInterface exif = new ExifInterface(out.getAbsolutePath());
                float[] ll = new float[2];
                if (exif.getLatLong(ll) && !(ll[0] == 0f && ll[1] == 0f)) {
                    // Single precision (~1 m); the app re-reads the tags at full precision.
                    r.put("lat", (double) ll[0]);
                    r.put("lng", (double) ll[1]);
                }
            } catch (Exception ignored) { /* no metadata */ }
            call.resolve(r);
        } catch (Exception e) {
            out.delete();
            call.reject("Couldn't open that photo", "READ_FAILED", e);
        }
    }

    private void copy(Uri from, File to) throws Exception {
        try (InputStream in = getContext().getContentResolver().openInputStream(from);
             OutputStream os = new FileOutputStream(to)) {
            if (in == null) throw new Exception("No data");
            byte[] buf = new byte[64 * 1024];
            int n;
            while ((n = in.read(buf)) > 0) os.write(buf, 0, n);
        }
    }
}

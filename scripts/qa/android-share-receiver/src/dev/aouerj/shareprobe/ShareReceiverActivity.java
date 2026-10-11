package dev.aouerj.shareprobe;

import android.app.Activity;
import android.os.Bundle;
import android.os.SystemClock;
import android.content.Intent;
import android.net.Uri;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.util.Log;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.security.MessageDigest;
import java.util.Arrays;
import org.json.JSONObject;

public final class ShareReceiverActivity extends Activity {
  private static final byte[] PNG = new byte[] {(byte)137,80,78,71,13,10,26,10};
  private TextView result;
  private ImageView preview;

  @Override public void onCreate(Bundle state) {
    super.onCreate(state);
    ScrollView scroll = new ScrollView(this);
    LinearLayout content = new LinearLayout(this);
    content.setOrientation(LinearLayout.VERTICAL);
    content.setPadding(24, 64, 24, 32);
    result = new TextView(this);
    result.setTextSize(18);
    result.setTextIsSelectable(true);
    content.addView(result, new LinearLayout.LayoutParams(-1, -2));
    preview = new ImageView(this);
    preview.setAdjustViewBounds(true);
    content.addView(preview, new LinearLayout.LayoutParams(-1, -2));
    Button close = new Button(this);
    close.setText("Concluir teste local");
    close.setOnClickListener(view -> finish());
    content.addView(close, new LinearLayout.LayoutParams(-1, -2));
    scroll.addView(content, new ScrollView.LayoutParams(-1, ViewGroup.LayoutParams.WRAP_CONTENT));
    setContentView(scroll);
    receive(getIntent());
  }

  @Override protected void onNewIntent(Intent intent) {
    super.onNewIntent(intent);
    setIntent(intent);
    receive(intent);
  }

  private void receive(Intent intent) {
    if (!Intent.ACTION_SEND.equals(intent.getAction())) {
      result.setText("AO PNG local\nReceptor de teste sem rede.\nNo AO UERJ, compartilhe o horario e escolha AO PNG local.\nA imagem sera lida apenas na memoria deste aplicativo.");
      return;
    }
    result.setText("Recebendo PNG local...\nValidando leitura imediata e apos 1,5 segundos.");
    preview.setImageDrawable(null);
    new Thread(() -> inspect(intent), "png-local-inspection").start();
  }

  private byte[] read(Uri uri) throws Exception {
    try (InputStream input = getContentResolver().openInputStream(uri);
         ByteArrayOutputStream bytes = new ByteArrayOutputStream()) {
      if (input == null) throw new IllegalStateException("NULL_STREAM");
      byte[] buffer = new byte[8192];
      int count;
      while ((count = input.read(buffer)) != -1) {
        if (bytes.size() + count > 32 * 1024 * 1024) throw new IllegalStateException("IMAGE_TOO_LARGE");
        bytes.write(buffer, 0, count);
      }
      return bytes.toByteArray();
    }
  }

  private static String sha256(byte[] data) throws Exception {
    StringBuilder text = new StringBuilder();
    for (byte value : MessageDigest.getInstance("SHA-256").digest(data)) text.append(String.format("%02x", value & 255));
    return text.toString();
  }

  private void inspect(Intent intent) {
    JSONObject report = new JSONObject();
    try {
      Uri uri = intent.getParcelableExtra(Intent.EXTRA_STREAM);
      if (uri == null && intent.getClipData() != null && intent.getClipData().getItemCount() > 0) uri = intent.getClipData().getItemAt(0).getUri();
      if (uri == null) throw new IllegalStateException("MISSING_URI");
      boolean readGrant = (intent.getFlags() & Intent.FLAG_GRANT_READ_URI_PERMISSION) != 0;
      report.put("scheme", uri.getScheme());
      report.put("authority", uri.getAuthority());
      report.put("intentMime", intent.getType());
      report.put("providerMime", getContentResolver().getType(uri));
      report.put("readPermissionFlag", readGrant);
      if (!"content".equals(uri.getScheme())) throw new IllegalStateException("EXPECTED_CONTENT_URI");
      if (!"image/png".equals(intent.getType())) throw new IllegalStateException("EXPECTED_PNG_MIME");
      if (!readGrant) throw new IllegalStateException("MISSING_READ_GRANT");
      byte[] data = read(uri);
      if (data.length < 24 || !Arrays.equals(PNG, Arrays.copyOf(data, 8))) throw new IllegalStateException("INVALID_PNG_SIGNATURE");
      BitmapFactory.Options bounds = new BitmapFactory.Options();
      bounds.inJustDecodeBounds = true;
      BitmapFactory.decodeByteArray(data, 0, data.length, bounds);
      if (bounds.outWidth <= 0 || bounds.outHeight <= 0 || !"image/png".equals(bounds.outMimeType)) throw new IllegalStateException("INVALID_PNG_DIMENSIONS");
      report.put("bytes", data.length);
      report.put("width", bounds.outWidth);
      report.put("height", bounds.outHeight);
      report.put("sha256", sha256(data));
      SystemClock.sleep(1500);
      byte[] delayed = read(uri);
      if (!Arrays.equals(data, delayed)) throw new IllegalStateException("DELAYED_READ_CHANGED");
      report.put("delayedReadMatches", true);
      report.put("networkPermission", false);
      report.put("savedCopy", false);
      report.put("ok", true);
      BitmapFactory.Options decode = new BitmapFactory.Options();
      decode.inSampleSize = 1;
      while (bounds.outWidth / decode.inSampleSize > 1400 || bounds.outHeight / decode.inSampleSize > 2000) decode.inSampleSize *= 2;
      Bitmap bitmap = BitmapFactory.decodeByteArray(data, 0, data.length, decode);
      if (bitmap == null) throw new IllegalStateException("PNG_DECODE_FAILED");
      String summary = "PNG RECEBIDO E VALIDADO\n\n" + report.toString(2) + "\n\nSem envio, sem rede, sem copia persistida.\n";
      Log.i("AOShareProbe", report.toString());
      runOnUiThread(() -> {
        result.setText(summary);
        preview.setImageBitmap(bitmap);
        setResult(RESULT_OK, new Intent().putExtra("probe_result", report.toString()));
      });
    } catch (Exception error) {
      try { report.put("ok", false); report.put("error", error.getClass().getSimpleName()); report.put("reason", error.getMessage() == null ? "UNSPECIFIED" : error.getMessage()); } catch (Exception ignored) { }
      String summary = "FALHA NO RECEBIMENTO LOCAL\n\n" + report.toString();
      Log.e("AOShareProbe", report.toString());
      runOnUiThread(() -> { result.setText(summary); setResult(RESULT_CANCELED); });
    }
  }
}

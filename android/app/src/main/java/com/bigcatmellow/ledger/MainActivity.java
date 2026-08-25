package com.bigcatmellow.ledger;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

public class MainActivity extends Activity {
    private static final String APP_HOST = "bigcatmellow.github.io";
    private static final String APP_PATH_PREFIX = "/Ledger-App/";
    private static final String APP_URL = "https://bigcatmellow.github.io/Ledger-App/";
    private static final String ANDROID_SYNC_URL = "https://bigcatmellow.github.io/Ledger-App/stationery/android-sync.html";
    private static final String ANDROID_BRIDGE_URL = "https://bigcatmellow.github.io/Ledger-App/stationery/android-bridge.js?v=1";
    private static final int FILE_CHOOSER_REQUEST = 1201;
    private static final int SAVE_FILE_REQUEST = 1202;

    private WebView webView;
    private ValueCallback<Uri[]> filePathCallback;
    private String pendingSaveName;
    private String pendingSaveMime;
    private String pendingSaveContent;

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        webView = new WebView(this);
        webView.setBackgroundColor(Color.parseColor("#F2EEE3"));
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowContentAccess(true);
        settings.setAllowFileAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setUserAgentString(settings.getUserAgentString() + " LedgerAndroid/0.1");

        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        cookieManager.setAcceptThirdPartyCookies(webView, false);

        webView.addJavascriptInterface(new LedgerAndroidBridge(), "LedgerAndroid");
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(
                    WebView view,
                    ValueCallback<Uri[]> filePath,
                    FileChooserParams fileChooserParams
            ) {
                if (filePathCallback != null) {
                    filePathCallback.onReceiveValue(null);
                }
                filePathCallback = filePath;
                try {
                    startActivityForResult(fileChooserParams.createIntent(), FILE_CHOOSER_REQUEST);
                    return true;
                } catch (ActivityNotFoundException error) {
                    filePathCallback = null;
                    Toast.makeText(MainActivity.this, "No file picker is available.", Toast.LENGTH_LONG).show();
                    return false;
                }
            }
        });

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return handleNavigation(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return handleNavigation(Uri.parse(url));
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                installAndroidPageBridge();
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                super.onReceivedError(view, request, error);
                if (request.isForMainFrame()) {
                    showNetworkError();
                }
            }
        });

        applyNativeTheme(false);
        if (savedInstanceState == null) {
            webView.loadUrl(APP_URL);
        } else {
            webView.restoreState(savedInstanceState);
        }
    }

    private boolean handleNavigation(Uri uri) {
        String scheme = uri.getScheme();
        String host = uri.getHost();
        String path = uri.getPath();

        if ("https".equalsIgnoreCase(scheme)
                && APP_HOST.equalsIgnoreCase(host)
                && "/Ledger-App/sync.html".equals(path)) {
            webView.loadUrl(ANDROID_SYNC_URL);
            return true;
        }

        if ("https".equalsIgnoreCase(scheme)
                && APP_HOST.equalsIgnoreCase(host)
                && path != null
                && path.startsWith(APP_PATH_PREFIX)) {
            return false;
        }

        if ("http".equalsIgnoreCase(scheme)
                || "https".equalsIgnoreCase(scheme)
                || "mailto".equalsIgnoreCase(scheme)
                || "tel".equalsIgnoreCase(scheme)) {
            try {
                startActivity(new Intent(Intent.ACTION_VIEW, uri));
            } catch (ActivityNotFoundException error) {
                Toast.makeText(this, "No app can open that link.", Toast.LENGTH_SHORT).show();
            }
        }
        return true;
    }

    private void installAndroidPageBridge() {
        String script = "(function(){"
                + "if(!window.LedgerAndroid)return;"
                + "if(!window.__ledgerAndroidThemeObserver){"
                + "var report=function(){try{LedgerAndroid.setTheme(document.documentElement.dataset.theme||'light')}catch(e){}};"
                + "report();"
                + "window.__ledgerAndroidThemeObserver=new MutationObserver(report);"
                + "window.__ledgerAndroidThemeObserver.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});"
                + "}"
                + "if(!document.getElementById('ledgerAndroidBridgeScript')){"
                + "var s=document.createElement('script');s.id='ledgerAndroidBridgeScript';s.src='" + ANDROID_BRIDGE_URL + "';document.head.appendChild(s);"
                + "}"
                + "})();";
        webView.evaluateJavascript(script, null);
    }

    private void applyNativeTheme(boolean dark) {
        int status = Color.parseColor(dark ? "#181715" : "#F2EEE3");
        int navigation = Color.parseColor(dark ? "#181715" : "#27241F");
        int page = Color.parseColor(dark ? "#1D1B18" : "#F2EEE3");

        getWindow().setStatusBarColor(status);
        getWindow().setNavigationBarColor(navigation);
        webView.setBackgroundColor(page);

        View decor = getWindow().getDecorView();
        int flags = decor.getSystemUiVisibility();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            if (dark) {
                flags &= ~View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
            } else {
                flags |= View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
            }
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            flags &= ~View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
        }
        decor.setSystemUiVisibility(flags);
    }

    private void showNetworkError() {
        String html = "<!doctype html><html><head><meta name='viewport' content='width=device-width,initial-scale=1'>"
                + "<style>body{margin:0;background:#f2eee3;color:#24221e;font:16px sans-serif;display:grid;place-items:center;min-height:100vh}"
                + ".card{max-width:420px;margin:24px;padding:24px;border:1px solid #bcb3a2;background:#f7f3e9}"
                + "h1{font:28px Georgia,serif;margin:0 0 10px}p{color:#625e55;line-height:1.5}"
                + "a{display:block;margin-top:18px;padding:12px;background:#ad4b3f;color:white;text-decoration:none;text-align:center;font-weight:700}</style>"
                + "</head><body><div class='card'><h1>Ledger is offline</h1><p>The Android app could not reach GitHub Pages. Your existing local Ledger data has not been changed.</p>"
                + "<a href='" + APP_URL + "'>Try again</a></div></body></html>";
        webView.loadDataWithBaseURL(APP_URL, html, "text/html", "UTF-8", null);
    }

    private void beginSave(String filename, String content, String mimeType) {
        pendingSaveName = (filename == null || filename.trim().isEmpty()) ? "ledger-export.md" : filename.trim();
        pendingSaveContent = content == null ? "" : content;
        pendingSaveMime = (mimeType == null || mimeType.trim().isEmpty()) ? "text/plain" : mimeType.trim();

        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType(pendingSaveMime);
        intent.putExtra(Intent.EXTRA_TITLE, pendingSaveName);
        try {
            startActivityForResult(intent, SAVE_FILE_REQUEST);
        } catch (ActivityNotFoundException error) {
            clearPendingSave();
            Toast.makeText(this, "No app can save this file.", Toast.LENGTH_LONG).show();
        }
    }

    private void writePendingSave(Uri uri) {
        if (pendingSaveContent == null) {
            return;
        }
        try (OutputStream output = getContentResolver().openOutputStream(uri)) {
            if (output == null) {
                throw new IOException("Android returned no writable stream");
            }
            output.write(pendingSaveContent.getBytes(StandardCharsets.UTF_8));
            output.flush();
            Toast.makeText(this, "Ledger export saved.", Toast.LENGTH_SHORT).show();
        } catch (IOException error) {
            Toast.makeText(this, "Ledger could not save that file.", Toast.LENGTH_LONG).show();
        } finally {
            clearPendingSave();
        }
    }

    private void clearPendingSave() {
        pendingSaveName = null;
        pendingSaveMime = null;
        pendingSaveContent = null;
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);

        if (requestCode == FILE_CHOOSER_REQUEST) {
            if (filePathCallback != null) {
                Uri[] result = WebChromeClient.FileChooserParams.parseResult(resultCode, data);
                filePathCallback.onReceiveValue(result);
                filePathCallback = null;
            }
            return;
        }

        if (requestCode == SAVE_FILE_REQUEST) {
            if (resultCode == RESULT_OK && data != null && data.getData() != null) {
                writePendingSave(data.getData());
            } else {
                clearPendingSave();
            }
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        webView.saveState(outState);
        super.onSaveInstanceState(outState);
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.removeJavascriptInterface("LedgerAndroid");
            webView.destroy();
        }
        super.onDestroy();
    }

    private class LedgerAndroidBridge {
        @JavascriptInterface
        public void setTheme(String theme) {
            runOnUiThread(() -> applyNativeTheme("dark".equalsIgnoreCase(theme)));
        }

        @JavascriptInterface
        public void saveTextFile(String filename, String content, String mimeType) {
            runOnUiThread(() -> beginSave(filename, content, mimeType));
        }
    }
}

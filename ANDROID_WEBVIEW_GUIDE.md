# Android WebView Implementation Guide for Referrer Leak Prevention

This guide provides the necessary Android code implementation to prevent referrer leaks in a WebView, as requested. Since this repository contains the web application code, these changes should be applied to the hosting Android application's `WebViewClient` and configuration.

## 1. WebViewClient Implementation

To add the `Referrer-Policy: no-referrer` header to external requests and strip the `Referer` header for cross-origin requests, you should override `shouldInterceptRequest` in your `WebViewClient`.

### Java Implementation

```java
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.HashMap;
import java.util.Map;

public class SecureWebViewClient extends WebViewClient {

    private boolean isTrustedDomain(String url) {
        // Implement your logic to check for trusted domains
        return url != null && (url.startsWith("file://") || url.contains("your-trusted-domain.com"));
    }

    @Override
    public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
        String urlString = request.getUrl().toString();

        // 1. Handle Trusted Domains / Debugging
        // Ensure file:// and app's trusted domains use Referrer-Policy: origin (or allow referrer)
        if (isTrustedDomain(urlString)) {
            // Let the WebView handle it normally, or intercept and set specific headers if needed.
            // Returning null tells WebView to handle the request normally.
            return null;
        }

        // 2. Prevent Referrer Leaks for External Requests
        try {
            URL url = new URL(urlString);
            HttpURLConnection connection = (HttpURLConnection) url.openConnection();

            // Copy headers from the original request
            Map<String, String> requestHeaders = request.getRequestHeaders();
            for (Map.Entry<String, String> entry : requestHeaders.entrySet()) {
                // Strip the Referer header for cross-origin requests manually if needed,
                // though Referrer-Policy: no-referrer usually handles this on the server side/client side.
                if (!"Referer".equalsIgnoreCase(entry.getKey())) {
                    connection.setRequestProperty(entry.getKey(), entry.getValue());
                }
            }

            // ADD THE REQUIRED HEADER
            connection.setRequestProperty("Referrer-Policy", "no-referrer");

            // Explicitly remove Referer header if strictly required
            // connection.setRequestProperty("Referer", ""); // Some libs might not allow setting empty

            connection.connect();

            // Return the response stream to the WebView
            String mimeType = connection.getContentType();
            String encoding = connection.getContentEncoding();
            if (mimeType != null && mimeType.contains(";")) {
                String[] parts = mimeType.split(";");
                mimeType = parts[0].trim();
                if (encoding == null && parts.length > 1) {
                    encoding = parts[1].replace("charset=", "").trim();
                }
            }

            return new WebResourceResponse(
                mimeType,
                encoding != null ? encoding : "UTF-8",
                connection.getResponseCode(),
                connection.getResponseMessage(),
                new HashMap<>(), // You might want to copy response headers here
                connection.getInputStream()
            );

        } catch (Exception e) {
            e.printStackTrace();
            // Fallback to default behavior or return error
            return null;
        }
    }
}
```

### Kotlin Implementation

```kotlin
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import java.net.HttpURLConnection
import java.net.URL

class SecureWebViewClient : WebViewClient() {

    private fun isTrustedDomain(url: String): Boolean {
        return url.startsWith("file://") || url.contains("your-trusted-domain.com")
    }

    override fun shouldInterceptRequest(view: WebView?, request: WebResourceRequest?): WebResourceResponse? {
        val urlString = request?.url.toString()

        if (isTrustedDomain(urlString)) {
            return null // Default behavior for trusted domains
        }

        return try {
            val url = URL(urlString)
            val connection = url.openConnection() as HttpURLConnection

            request?.requestHeaders?.forEach { (key, value) ->
                if (!key.equals("Referer", ignoreCase = true)) {
                    connection.setRequestProperty(key, value)
                }
            }

            // Implement Referrer Leak Prevention
            connection.setRequestProperty("Referrer-Policy", "no-referrer")

            connection.connect()

            val contentType = connection.contentType?.split(";")
            val mimeType = contentType?.getOrNull(0)?.trim()
            val encoding = contentType?.getOrNull(1)?.replace("charset=", "")?.trim() ?: "UTF-8"

            WebResourceResponse(
                mimeType,
                encoding,
                connection.responseCode,
                connection.responseMessage,
                mutableMapOf(), // Populate response headers if needed
                connection.inputStream
            )
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }
}
```

## 2. Web Application Changes (Already Applied)

In addition to the Android changes, the following changes have been applied to the web application in this repository to support the policy from the frontend:

1.  **`index.html`**: A script has been added to the `<head>` to dynamically inject a `<meta name="referrer">` tag.
    *   `content="origin"` for `file://` and `localhost` (debugging).
    *   `content="no-referrer"` for all other environments.

2.  **`src/modules/prompt-renderer.js`**: The `sanitizeHtml` function now adds `referrerpolicy="no-referrer"` to all rendered `<img>` tags (e.g., in markdown previews) using a DOMPurify hook.

## 3. Verification

To verify these changes:
1.  **Unit Tests**: Run `npm run test:run src/tests/referrer-policy.test.js`.
2.  **Network Inspection**: Use Charles Proxy or Chrome DevTools (Remote Debugging for Android) to inspect network requests initiated by the WebView. Confirm that the `Referer` header is missing for external requests.

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const fetch = require("node-fetch");

admin.initializeApp();

// Decrypt Jules API key using Web Crypto API (Node 22+)
// Must match client encryption: key padded to 32 bytes with '\0', IV first 12 chars padded with '0'
async function decryptJulesKeyBase64(b64, uid) {
  try {
    const enc = Buffer.from(b64, "base64");
    const encView = enc.buffer.slice(enc.byteOffset, enc.byteOffset + enc.byteLength);
    const te = new TextEncoder();
    const td = new TextDecoder();

    const paddedKeyString = (uid + '\0'.repeat(32)).slice(0, 32);
    const keyBytes = te.encode(paddedKeyString);
    const key = await crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, ["decrypt"]);

    const ivBytes = te.encode(uid.slice(0, 12).padEnd(12, "0")).slice(0, 12);
    const plainBuf = await crypto.subtle.decrypt({ name: "AES-GCM", iv: ivBytes }, key, encView);

    return td.decode(plainBuf);
  } catch (error) {
    console.error("Decryption error:", error.message);
    throw new Error("Failed to decrypt Jules API key");
  }
}

// Callable function - requires Firebase Auth context
exports.runJules = functions.https.onCall(async (data, context) => {
  let uid = context.auth?.uid;
  
  if (!uid && context.rawRequest?.headers) {
    try {
      const authHeader = context.rawRequest.headers['x-auth-token'];
      if (authHeader) {
        const decodedToken = await admin.auth().verifyIdToken(authHeader);
        uid = decodedToken.uid;
      }
    } catch (e) {
      // Fallback auth attempt
    }
  }

  if (!uid) {
    throw new functions.https.HttpsError("unauthenticated", "Must be signed in to use Jules");
  }

  const promptText = (data && data.promptText) || "";

  if (!promptText || typeof promptText !== "string" || promptText.length < 4) {
    throw new functions.https.HttpsError("invalid-argument", "Prompt text is required (minimum 4 characters)");
  }

  try {
    const db = admin.firestore();
    const snap = await db.doc(`julesKeys/${uid}`).get();

    if (!snap.exists) {
      throw new functions.https.HttpsError("failed-precondition", "No Jules API key stored. Please save your API key first.");
    }

    const encryptedBase64 = snap.data().key;
    if (!encryptedBase64) {
      throw new functions.https.HttpsError("failed-precondition", "Stored key is missing or invalid");
    }

    let julesKey;
    try {
      julesKey = await decryptJulesKeyBase64(encryptedBase64, uid);
    } catch (e) {
      console.error("Decryption failed for user:", uid);
      throw new functions.https.HttpsError("internal", "Failed to decrypt Jules API key");
    }

    const julesBody = {
      title: "Prompt-Sharing Trigger",
      prompt: promptText,
      sourceContext: {
        source: "sources/github/open-learning-exchange/planet",
        githubRepoContext: { startingBranch: "master" }
      },
      automationMode: "AUTO_CREATE_PR"
    };

    let r, json;
    try {
      r = await fetch("https://jules.googleapis.com/v1alpha/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Goog-Api-Key": julesKey },
        body: JSON.stringify(julesBody)
      });
      json = await r.json();
    } catch (e) {
      console.error("Network error calling Jules:", e.message);
      throw new functions.https.HttpsError("unavailable", "Failed to reach Jules API");
    }

    if (!r.ok) {
      console.error("Jules API error:", r.status, json);
      throw new functions.https.HttpsError("permission-denied", `Jules API error: ${r.status}`);
    }

    if (!json || !json.url) {
      console.error("Jules response missing url:", json);
      throw new functions.https.HttpsError("internal", "Jules did not return a session URL");
    }

    return { sessionUrl: json.url };

  } catch (error) {
    if (error.code && error.code.startsWith("functions/")) {
      throw error;
    }
    console.error("Error in runJules:", error.message);
    throw new functions.https.HttpsError("internal", error.message || "Failed to create Jules session");
  }
});

// HTTPS endpoint version - avoids compat SDK auth context issue
exports.runJulesHttp = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'POST') {
    res.status(400).json({ error: 'Method not allowed. Use POST.' });
    return;
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing or invalid Authorization header' });
      return;
    }

    const idToken = authHeader.substring('Bearer '.length);
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const uid = decodedToken.uid;

    const { promptText } = req.body || {};

    if (!promptText || typeof promptText !== 'string' || promptText.length < 4) {
      res.status(400).json({ error: 'promptText must be a non-empty string (min 4 chars)' });
      return;
    }

    const db = admin.firestore();
    const snap = await db.doc(`julesKeys/${uid}`).get();

    if (!snap.exists) {
      res.status(404).json({ error: 'No Jules API key stored. Please save your API key first.' });
      return;
    }

    const encryptedBase64 = snap.data().key;
    if (!encryptedBase64) {
      res.status(400).json({ error: 'Stored key is missing or invalid' });
      return;
    }

    let julesKey;
    try {
      julesKey = await decryptJulesKeyBase64(encryptedBase64, uid);
    } catch (e) {
      console.error('Decryption failed:', e.message);
      res.status(500).json({ error: 'Failed to decrypt Jules API key' });
      return;
    }

    const julesBody = {
      title: "Prompt-Sharing Trigger",
      prompt: promptText,
      sourceContext: {
        source: "sources/github/open-learning-exchange/planet",
        githubRepoContext: { startingBranch: "master" }
      },
      automationMode: "AUTO_CREATE_PR"
    };

    let r, json;
    try {
      r = await fetch("https://jules.googleapis.com/v1alpha/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Goog-Api-Key": julesKey },
        body: JSON.stringify(julesBody)
      });
      json = await r.json();
    } catch (e) {
      console.error('Network error calling Jules:', e.message);
      res.status(503).json({ error: 'Failed to reach Jules API' });
      return;
    }

    if (!r.ok) {
      console.error('Jules API error:', r.status, json);
      res.status(502).json({ error: `Jules API error: ${r.status}` });
      return;
    }

    if (!json || !json.url) {
      console.error('Jules response missing url:', json);
      res.status(500).json({ error: 'Jules did not return a session URL' });
      return;
    }

    res.json({ sessionUrl: json.url });

  } catch (error) {
    console.error('Error in runJulesHttp:', error.message);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Validates a Jules API key by testing a request
exports.validateJulesKey = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Must be signed in");
  }

  try {
    const uid = context.auth.uid;
    const db = admin.firestore();
    const snap = await db.doc(`julesKeys/${uid}`).get();

    if (!snap.exists) {
      return { valid: false, message: "No Jules API key stored" };
    }

    const encryptedBase64 = snap.data().key;
    const julesKey = await decryptJulesKeyBase64(encryptedBase64, uid);

    const r = await fetch("https://jules.googleapis.com/v1alpha/sessions", {
      method: "GET",
      headers: { "X-Goog-Api-Key": julesKey }
    });

    return {
      valid: r.ok,
      message: r.ok ? "API key is valid" : `Invalid key (HTTP ${r.status})`
    };

  } catch (error) {
    return { valid: false, message: `Validation error: ${error.message}` };
  }
});

// Returns metadata about stored Jules API key (not the key itself)
exports.getJulesKeyInfo = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Must be signed in");
  }

  try {
    const uid = context.auth.uid;
    const db = admin.firestore();
    const snap = await db.doc(`julesKeys/${uid}`).get();

    if (!snap.exists) {
      return { hasKey: false };
    }

    const docData = snap.data();
    return {
      hasKey: true,
      storedAt: docData.storedAt ? docData.storedAt.toDate() : null,
      keyLength: (docData.key || "").length
    };

  } catch (error) {
    throw new functions.https.HttpsError("internal", `Error retrieving key info: ${error.message}`);
  }
});

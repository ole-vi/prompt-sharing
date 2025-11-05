const functions = require("firebase-functions");
const admin = require("firebase-admin");
const fetch = require("node-fetch");

admin.initializeApp();

/**
 * Decrypt Jules API key using Web Crypto API (available in Node 22)
 * Mirrors the client-side AES-GCM decryption
 * MUST match client encryption scheme exactly:
 * - Key: UID padded to 32 bytes with NULL character '\0'
 * - IV: first 12 chars of UID, padded to 12 bytes with '0'
 */
async function decryptJulesKeyBase64(b64, uid) {
  try {
    // Decode from base64 to buffer
    const enc = Buffer.from(b64, "base64");
    const encView = enc.buffer.slice(enc.byteOffset, enc.byteOffset + enc.byteLength);

    const te = new TextEncoder();
    const td = new TextDecoder();

    // Create key: pad UID to 32 bytes with NULL character (MUST match client: '\0')
    const paddedKeyString = (uid + '\0'.repeat(32)).slice(0, 32);
    const keyBytes = te.encode(paddedKeyString);
    const key = await crypto.subtle.importKey(
      "raw",
      keyBytes,
      { name: "AES-GCM" },
      false,
      ["decrypt"]
    );

    // Create IV: first 12 chars of UID, padded to 12 bytes with '0'
    const ivBytes = te.encode(uid.slice(0, 12).padEnd(12, "0")).slice(0, 12);

    // Decrypt
    const plainBuf = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: ivBytes },
      key,
      encView
    );

    return td.decode(plainBuf);
  } catch (error) {
    console.error("Decryption error:", error.message);
    throw new Error("Failed to decrypt Jules API key");
  }
}

/**
 * Cloud Function: runJules
 * Callable function - requires Firebase Auth context
 */
exports.runJules = functions.https.onCall(async (data, context) => {
  // Try to get auth from context first (for new SDK)
  let uid = context.auth?.uid;
  
  // If not available, try to extract from custom header (fallback for compat SDK)
  if (!uid && context.rawRequest?.headers) {
    try {
      const authHeader = context.rawRequest.headers['x-auth-token'];
      if (authHeader) {
        const decodedToken = await admin.auth().verifyIdToken(authHeader);
        uid = decodedToken.uid;
        console.log('✓ Auth verified from X-Auth-Token header');
      }
    } catch (e) {
      console.log('Could not verify X-Auth-Token header:', e.message);
    }
  }

  // Final check
  if (!uid) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Must be signed in to use Jules"
    );
  }

  const promptText = (data && data.promptText) || "";

  // Validate input
  if (!promptText || typeof promptText !== "string" || promptText.length < 4) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Prompt text is required (minimum 4 characters)"
    );
  }

  try {
    // Get encrypted Jules API key from Firestore
    const db = admin.firestore();
    const snap = await db.doc(`julesKeys/${uid}`).get();

    if (!snap.exists) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "No Jules API key stored. Please save your API key first."
      );
    }

    const encryptedBase64 = snap.data().key;
    if (!encryptedBase64) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Stored key is missing or invalid"
      );
    }

    // Decrypt the stored key
    let julesKey;
    try {
      julesKey = await decryptJulesKeyBase64(encryptedBase64, uid);
      console.log("✓ Jules key decrypted successfully for user:", uid);
    } catch (e) {
      console.error("Decryption failed for user:", uid);
      throw new functions.https.HttpsError(
        "internal",
        "Failed to decrypt Jules API key"
      );
    }

    // Prepare request body for Jules API
    const julesBody = {
      title: "Prompt-Sharing Trigger",
      prompt: promptText,
      sourceContext: {
        source: "sources/github/open-learning-exchange/planet",
        githubRepoContext: { startingBranch: "master" }
      },
      automationMode: "AUTO_CREATE_PR"
    };

    console.log("Calling Jules API...");

    // Call Jules API
    let r, json;
    try {
      r = await fetch("https://jules.googleapis.com/v1alpha/sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": julesKey
        },
        body: JSON.stringify(julesBody)
      });
      json = await r.json();
    } catch (e) {
      console.error("Network error calling Jules:", e.message);
      throw new functions.https.HttpsError(
        "unavailable",
        "Failed to reach Jules API"
      );
    }

    // Check for errors
    if (!r.ok) {
      console.error("Jules API error:", r.status, json);
      throw new functions.https.HttpsError(
        "permission-denied",
        `Jules API error: ${r.status}`
      );
    }

    // Verify response has session URL
    if (!json || !json.url) {
      console.error("Jules response missing url:", json);
      throw new functions.https.HttpsError(
        "internal",
        "Jules did not return a session URL"
      );
    }

    console.log("✓ Jules session created successfully");

    return { sessionUrl: json.url };

  } catch (error) {
    if (error.code && error.code.startsWith("functions/")) {
      // Already an HttpsError, re-throw
      throw error;
    }
    
    console.error("Error in runJules:", error.message);
    throw new functions.https.HttpsError(
      "internal",
      error.message || "Failed to create Jules session"
    );
  }
});

/**
 * HTTPS endpoint version of runJules
 * Called directly via REST with Bearer token in Authorization header
 * This avoids the compat SDK auth context issue
 */
exports.runJulesHttp = functions.https.onRequest(async (req, res) => {
  // Enable CORS
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
    // Verify Bearer token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing or invalid Authorization header' });
      return;
    }

    const idToken = authHeader.substring('Bearer '.length);

    // Verify the ID token with Firebase Admin
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const uid = decodedToken.uid;

    console.log('✓ Auth token verified for user:', uid);

    const { promptText } = req.body || {};

    if (!promptText || typeof promptText !== 'string' || promptText.length < 4) {
      res.status(400).json({ error: 'promptText must be a non-empty string (min 4 chars)' });
      return;
    }

    // Get encrypted Jules API key from Firestore
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

    // Decrypt the stored key
    let julesKey;
    try {
      julesKey = await decryptJulesKeyBase64(encryptedBase64, uid);
      console.log('✓ Jules key decrypted successfully');
    } catch (e) {
      console.error('Decryption failed:', e.message);
      res.status(500).json({ error: 'Failed to decrypt Jules API key' });
      return;
    }

    // Prepare request body for Jules API
    const julesBody = {
      title: "Prompt-Sharing Trigger",
      prompt: promptText,
      sourceContext: {
        source: "sources/github/open-learning-exchange/planet",
        githubRepoContext: { startingBranch: "master" }
      },
      automationMode: "AUTO_CREATE_PR"
    };

    console.log('Calling Jules API...');

    // Call Jules API
    let r, json;
    try {
      r = await fetch("https://jules.googleapis.com/v1alpha/sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": julesKey
        },
        body: JSON.stringify(julesBody)
      });
      json = await r.json();
    } catch (e) {
      console.error('Network error calling Jules:', e.message);
      res.status(503).json({ error: 'Failed to reach Jules API' });
      return;
    }

    // Check for errors
    if (!r.ok) {
      console.error('Jules API error:', r.status, json);
      res.status(502).json({ error: `Jules API error: ${r.status}` });
      return;
    }

    // Verify response has session URL
    if (!json || !json.url) {
      console.error('Jules response missing url:', json);
      res.status(500).json({ error: 'Jules did not return a session URL' });
      return;
    }

    console.log('✓ Jules session created successfully');

    res.json({ sessionUrl: json.url });

  } catch (error) {
    console.error('Error in runJulesHttp:', error.message);
    res.status(500).json({
      error: error.message || 'Internal server error'
    });
  }
});

/**
 * Cloud Function: validateJulesKey (optional, for testing)
 * Validates that a Jules API key works by testing a simple request
 */
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

    // Try a simple request to Jules API to validate the key
    const r = await fetch("https://jules.googleapis.com/v1alpha/sessions", {
      method: "GET",
      headers: {
        "X-Goog-Api-Key": julesKey
      }
    });

    return {
      valid: r.ok,
      message: r.ok ? "API key is valid" : `Invalid key (HTTP ${r.status})`
    };

  } catch (error) {
    return {
      valid: false,
      message: `Validation error: ${error.message}`
    };
  }
});

/**
 * Cloud Function: getJulesKeyInfo (optional, for debugging)
 * Returns metadata about stored Jules API key (not the key itself)
 */
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
    throw new functions.https.HttpsError(
      "internal",
      `Error retrieving key info: ${error.message}`
    );
  }
});

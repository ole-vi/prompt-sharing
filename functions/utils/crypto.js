// functions/utils/crypto.js
const { subtle } = require('crypto').webcrypto;

async function decryptJulesKeyBase64(b64, uid) {
  try {
    const enc = Buffer.from(b64, "base64");
    const encView = enc.buffer.slice(enc.byteOffset, enc.byteOffset + enc.byteLength);
    const te = new TextEncoder();
    const td = new TextDecoder();

    const paddedKeyString = (uid + '\0'.repeat(32)).slice(0, 32);
    const keyBytes = te.encode(paddedKeyString);
    const key = await subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, ["decrypt"]);

    const ivBytes = te.encode(uid.slice(0, 12).padEnd(12, "0")).slice(0, 12);
    const plainBuf = await subtle.decrypt({ name: "AES-GCM", iv: ivBytes }, key, encView);

    return td.decode(plainBuf);
  } catch (error) {
    console.error("Decryption error:", error.message);
    throw new Error("Failed to decrypt Jules API key");
  }
}

module.exports = { decryptJulesKeyBase64 };

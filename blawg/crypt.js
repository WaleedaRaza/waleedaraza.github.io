/* ═══════════════════════════════════════════════════════════════════════
   BLAWG CRYPT — password-protected posts on a static site
   ───────────────────────────────────────────────────────────────────────
   A protected post's body is encrypted before it ever enters the repo:
     key  = PBKDF2-SHA256(password, random 16-byte salt, 600 000 rounds)
     data = AES-256-GCM(key, random 12-byte iv, body)
   posts.js only stores { v, iter, salt, iv, ct } (base64). Without the
   password the text cannot be recovered; GCM also detects a wrong password.
   The protection is as strong as the password: use a long one.

   Used by blawg/index.html (decrypt) and blawg/_tools/encrypt.html (encrypt).
   ═══════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  var ITER = 600000;
  var enc = new TextEncoder(), dec = new TextDecoder();

  function b64(buf) {
    var bytes = new Uint8Array(buf), s = '';
    for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s);
  }
  function unb64(str) {
    var s = atob(str), out = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  }
  function available() { return !!(global.crypto && global.crypto.subtle); }

  function deriveKey(password, salt, iter) {
    return crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey'])
      .then(function (base) {
        return crypto.subtle.deriveKey(
          { name: 'PBKDF2', salt: salt, iterations: iter, hash: 'SHA-256' },
          base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
      });
  }

  function encrypt(plaintext, password) {
    var salt = crypto.getRandomValues(new Uint8Array(16));
    var iv = crypto.getRandomValues(new Uint8Array(12));
    return deriveKey(password, salt, ITER).then(function (key) {
      return crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, enc.encode(plaintext));
    }).then(function (ct) {
      return { v: 1, iter: ITER, salt: b64(salt), iv: b64(iv), ct: b64(ct) };
    });
  }

  /* Resolves with the plaintext, rejects on a wrong password. */
  function decrypt(payload, password) {
    return deriveKey(password, unb64(payload.salt), payload.iter || ITER).then(function (key) {
      return crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(payload.iv) }, key, unb64(payload.ct));
    }).then(function (pt) { return dec.decode(pt); });
  }

  global.BlawgCrypt = { encrypt: encrypt, decrypt: decrypt, available: available };
})(window);

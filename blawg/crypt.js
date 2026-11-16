/* ═══════════════════════════════════════════════════════════════════════
   BLAWG CRYPT — essays read on request, on a static site
   ───────────────────────────────────────────────────────────────────────
   Nothing readable is ever in the repo. The pieces:

   MASTER   the author's passphrase, never stored anywhere.
            master = PBKDF2-SHA256(passphrase, 600 000 rounds)
   ESSAY    every essay has its own key, derived from the master and the
            essay's slug:  key = HMAC-SHA256(master, "essay:" + slug)
            The essay is sealed with AES-256-GCM -> blawg/sealed/<slug>.js
   CODE     what a reader is given. A code opens one RING: a small sealed
            bundle holding the keys of exactly the essays granted to that
            reader -> blawg/sealed/keys.js
            PBKDF2-SHA256(code, 250 000 rounds) gives 64 bytes: the first 6
            are the ring's public id, the last 32 are the key that opens it.

   A reader with a code can open their essays and nothing else. Removing a
   ring from keys.js stops that code working (it cannot unread what was
   already read). Used by blawg/index.html and blawg/_tools/studio.html.
   ═══════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  var enc = new TextEncoder(), dec = new TextDecoder();
  var MASTER_ITER = 600000, CODE_ITER = 250000;
  var ALPHABET = 'ABCDEFGHJKMNPQRSTVWXYZ23456789';   // no I L O U 0 1: easy to read out loud

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
  function hex(bytes) {
    var s = '';
    for (var i = 0; i < bytes.length; i++) s += ('0' + bytes[i].toString(16)).slice(-2);
    return s;
  }
  function available() { return !!(global.crypto && global.crypto.subtle); }

  function pbkdf2(secret, salt, iter, bits) {
    return crypto.subtle.importKey('raw', enc.encode(secret), 'PBKDF2', false, ['deriveBits'])
      .then(function (base) {
        return crypto.subtle.deriveBits({ name: 'PBKDF2', salt: enc.encode(salt), iterations: iter, hash: 'SHA-256' }, base, bits);
      }).then(function (buf) { return new Uint8Array(buf); });
  }
  function hmac(keyBytes, label) {
    return crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
      .then(function (k) { return crypto.subtle.sign('HMAC', k, enc.encode(label)); })
      .then(function (buf) { return new Uint8Array(buf); });
  }
  function aes(keyBytes) {
    return crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['encrypt', 'decrypt']);
  }
  /* seal / open: AES-256-GCM with a fresh iv. open() rejects on a wrong key. */
  function seal(text, keyBytes) {
    var iv = crypto.getRandomValues(new Uint8Array(12));
    return aes(keyBytes).then(function (k) {
      return crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, k, enc.encode(text));
    }).then(function (ct) { return { iv: b64(iv), ct: b64(ct) }; });
  }
  function open(box, keyBytes) {
    return aes(keyBytes).then(function (k) {
      return crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(box.iv) }, k, unb64(box.ct));
    }).then(function (pt) { return dec.decode(pt); });
  }

  /* ── author side ── */
  function master(passphrase) { return pbkdf2(passphrase, 'blawg-master-v1', MASTER_ITER, 256); }
  function masterCheck(m) { return hmac(m, 'check').then(function (h) { return b64(h.subarray(0, 12)); }); }
  function essayKey(m, slug) { return hmac(m, 'essay:' + slug); }
  function notesKey(m) { return hmac(m, 'ring-notes'); }

  /* ── codes ── */
  function normCode(code) { return String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }
  function newCode() {
    var out = '', buf = new Uint8Array(1);
    while (out.length < 20) {
      crypto.getRandomValues(buf);
      if (buf[0] < 240) out += ALPHABET.charAt(buf[0] % 30);   // 240 = 8 x 30, so no bias
    }
    return out.replace(/(.{5})(?=.)/g, '$1-');
  }
  /* -> { id, key } */
  function codeKeys(code) {
    return pbkdf2(normCode(code), 'blawg-code-v1', CODE_ITER, 512).then(function (b) {
      return { id: hex(b.subarray(0, 6)), key: b.subarray(32, 64) };
    });
  }
  /* Reader: try a code against the published rings.
     Resolves { id, name, keys: { slug: Uint8Array } } or rejects. */
  function openRing(code, rings) {
    return codeKeys(code).then(function (ck) {
      var ring = (rings || []).filter(function (r) { return r.id === ck.id; })[0];
      if (!ring) throw new Error('unknown code');
      return open(ring, ck.key).then(function (json) {
        var data = JSON.parse(json), keys = {};
        Object.keys(data.keys).forEach(function (s) { keys[s] = unb64(data.keys[s]); });
        return { id: ck.id, name: data.name || '', keys: keys };
      });
    });
  }

  global.BlawgCrypt = {
    available: available, b64: b64, unb64: unb64, seal: seal, open: open,
    master: master, masterCheck: masterCheck, essayKey: essayKey, notesKey: notesKey,
    normCode: normCode, newCode: newCode, codeKeys: codeKeys, openRing: openRing
  };
})(window);

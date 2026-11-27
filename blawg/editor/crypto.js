// Blawg editor crypto: PBKDF2-SHA256 -> AES-GCM-256, all via WebCrypto.
// Nothing here ever stores a key or a plaintext; callers keep CryptoKeys in memory only.
export const ITER = 310000;
const te = new TextEncoder();
const td = new TextDecoder();

export function b64(bytes) {
  const u = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
  return btoa(s);
}
export function unb64(s) {
  const bin = atob(s);
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u;
}
export const utf8 = (s) => te.encode(s);
export const fromUtf8 = (u) => td.decode(u);
export function randomBytes(n) { return crypto.getRandomValues(new Uint8Array(n)); }

function concat(a, b) { const u = new Uint8Array(a.length + b.length); u.set(a, 0); u.set(b, a.length); return u; }

// Token-vault salt input: random salt + the username, so a wrong username derives a different key.
export function vaultSalt(randomSalt, username) {
  return concat(randomSalt, utf8('\u0000blawg-vault\u0000' + username));
}

export async function deriveKey(password, saltBytes, iter = ITER) {
  if (iter < ITER) throw new Error('iteration count below ' + ITER);
  const base = await crypto.subtle.importKey('raw', utf8(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: saltBytes, iterations: iter },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export async function encryptBytes(key, bytes) {
  const iv = randomBytes(12);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, bytes));
  return { iv: b64(iv), ct: b64(ct) };
}
export async function decryptBytes(key, iv, ct) {
  // throws on wrong key (GCM tag check) - nothing partial is ever returned
  return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv) }, key, unb64(ct)));
}
export async function encryptJSON(key, obj) { return encryptBytes(key, utf8(JSON.stringify(obj))); }
export async function decryptJSON(key, iv, ct) { return JSON.parse(fromUtf8(await decryptBytes(key, iv, ct))); }

// ---- token vault (localStorage) ----
export const VAULT_KEY = 'blawg.editor.vault';
export const PENDING_KEY = 'blawg.editor.pending';

export async function createVault(username, password, secret) {
  const salt = randomBytes(16);
  const key = await deriveKey(password, vaultSalt(salt, username));
  const { iv, ct } = await encryptJSON(key, secret);
  const env = { v: 1, kdf: 'PBKDF2-SHA256', iter: ITER, salt: b64(salt), iv, ct };
  return { env, key };
}
export async function openVault(env, username, password) {
  if (!env || env.v !== 1 || env.kdf !== 'PBKDF2-SHA256') throw new Error('Unknown vault format.');
  const key = await deriveKey(password, vaultSalt(unb64(env.salt), username), env.iter);
  let secret;
  try { secret = await decryptJSON(key, env.iv, env.ct); }
  catch (e) { throw new Error('Wrong username or password. Nothing was decrypted.'); }
  return { key, secret };
}
export async function resealVault(env, key, secret) {
  const { iv, ct } = await encryptJSON(key, secret);
  return { ...env, iv, ct };
}

// ---- drafts.enc ----
// Key derives from the password alone with the file's own random salt (separate from the vault salt),
// so drafts open on any device with the same password.
export async function draftsKey(password, saltB64, iter = ITER) {
  const salt = saltB64 ? unb64(saltB64) : randomBytes(16);
  const key = await deriveKey(password, salt, iter);
  return { key, salt: b64(salt) };
}
export async function sealDrafts(key, saltB64, plain) {
  const { iv, ct } = await encryptJSON(key, plain);
  return { v: 1, kdf: 'PBKDF2-SHA256', iter: ITER, salt: saltB64, iv, ct };
}
export async function openDrafts(key, env) {
  try { return await decryptJSON(key, env.iv, env.ct); }
  catch (e) { throw new Error('drafts.enc could not be opened with this password.'); }
}

// Blawg editor: saving to GitHub with the git data API (one commit per Publish).
// Refuses, client side, any path that is not under blawg/.
import { b64, unb64, utf8, fromUtf8 } from './crypto.js';
import { pathAllowed } from './model.js';

export const API = 'https://api.github.com';

export class GitHubError extends Error {
  constructor(status, msg) { super(msg); this.status = status; }
}

export function assertBlawgPath(p) {
  if (!pathAllowed(p)) throw new Error(`Refusing to commit a path outside blawg/: ${p}`);
}

export class GitHub {
  constructor({ token, owner, repo }) {
    this.token = token; this.owner = owner; this.repo = repo;
  }
  wipe() { this.token = null; }
  async req(method, path, body) {
    if (!this.token) throw new Error('Signed out.');
    const url = `${API}/repos/${encodeURIComponent(this.owner)}/${encodeURIComponent(this.repo)}${path}`;
    let r;
    try {
      r = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${this.token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', ...(body ? { 'Content-Type': 'application/json' } : {}) },
        body: body ? JSON.stringify(body) : undefined,
        cache: 'no-store',
      });
    } catch (e) { throw new GitHubError(0, 'Could not reach GitHub (offline or blocked).'); }
    if (r.status === 204) return null;
    let data = null;
    try { data = await r.json(); } catch (e) { /* empty */ }
    if (!r.ok) throw new GitHubError(r.status, `GitHub ${r.status}: ${(data && data.message) || r.statusText} (${method} ${path.split('?')[0]})`);
    return data;
  }
  repoInfo() { return this.req('GET', ''); }
  async getRef(branch) {
    try { const d = await this.req('GET', `/git/ref/heads/${encodeURIComponent(branch)}`); return d.object.sha; }
    catch (e) { if (e.status === 404) return null; throw e; }
  }
  createRef(branch, sha) { return this.req('POST', '/git/refs', { ref: `refs/heads/${branch}`, sha }); }
  updateRef(branch, sha) { return this.req('PATCH', `/git/refs/heads/${encodeURIComponent(branch)}`, { sha, force: false }); }
  getCommit(sha) { return this.req('GET', `/git/commits/${sha}`); }
  async getTree(sha) {
    const d = await this.req('GET', `/git/trees/${sha}?recursive=1`);
    if (d.truncated) throw new Error('Repository tree is too large to read in one go.');
    return d.tree.filter((e) => e.type === 'blob');
  }
  async getBlob(sha) { const d = await this.req('GET', `/git/blobs/${sha}`); return unb64(String(d.content).replace(/\s+/g, '')); }
  async getText(sha) { return fromUtf8(await this.getBlob(sha)); }
  async createBlob(bytes) { const d = await this.req('POST', '/git/blobs', { content: b64(bytes), encoding: 'base64' }); return d.sha; }
  async createTree(baseTree, entries) { const d = await this.req('POST', '/git/trees', { base_tree: baseTree, tree: entries }); return d.sha; }
  async createCommit(message, tree, parents) { const d = await this.req('POST', '/git/commits', { message, tree, parents }); return d.sha; }
}

const WATCH = (p) => p.startsWith('blawg/') || p.startsWith('assets/ascii/');

// Read the blawg/ state at a branch. Returns {branch, head, tree, shas:{path:sha}, json:{...}, bodies:{id:text}, draftsEnv, files:[...]}
export async function loadSnapshot(gh, branch) {
  const head = await gh.getRef(branch);
  if (!head) return null;
  const commit = await gh.getCommit(head);
  const entries = (await gh.getTree(commit.tree.sha)).filter((e) => WATCH(e.path));
  const shas = {};
  for (const e of entries) shas[e.path] = e.sha;
  const readJSON = async (p, dflt) => (shas[p] ? JSON.parse(await gh.getText(shas[p])) : dflt);
  const json = {
    pieces: await readJSON('blawg/data/pieces.json', []),
    connections: await readJSON('blawg/data/connections.json', []),
    art: await readJSON('blawg/data/art.json', null),
    groups: await readJSON('blawg/data/groups.json', []),
  };
  const draftsEnv = await readJSON('blawg/data/drafts.enc', null);
  const bodies = {};
  for (const p of json.pieces) {
    const path = `blawg/pieces/${p.id}.md`;
    if (p.body && shas[path]) bodies[p.id] = await gh.getText(shas[path]);
  }
  return { branch, head, tree: commit.tree.sha, shas, json, bodies, draftsEnv, files: Object.keys(shas) };
}

// Tracked paths: if any of these differ between two snapshots, the remote changed under us.
export function changedPaths(oldShas, newShas) {
  const keys = new Set([...Object.keys(oldShas), ...Object.keys(newShas)].filter((p) => p.startsWith('blawg/data/') || p.startsWith('blawg/pieces/')));
  return [...keys].filter((k) => oldShas[k] !== newShas[k]);
}

// One commit on `branch` on top of `head` (create: make the branch, pointing at the new commit). writes: {path: string|Uint8Array}, deletes: [path]
export async function commitFiles(gh, { branch, head, baseTree, writes, deletes = [], message, create = false }) {
  const paths = [...Object.keys(writes), ...deletes];
  for (const p of paths) assertBlawgPath(p);
  if (!paths.length) throw new Error('Nothing to commit.');
  const entries = [];
  for (const [path, content] of Object.entries(writes)) {
    const sha = await gh.createBlob(typeof content === 'string' ? utf8(content) : content);
    entries.push({ path, mode: '100644', type: 'blob', sha });
  }
  for (const path of deletes) entries.push({ path, mode: '100644', type: 'blob', sha: null });
  const tree = await gh.createTree(baseTree, entries);
  const commit = await gh.createCommit(message, tree, [head]);
  if (create) await gh.createRef(branch, commit); else await gh.updateRef(branch, commit);
  return commit;
}

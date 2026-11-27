// In-memory GitHub (git data API subset) for the editor tests. Fake data only.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const gitSha = (buf) => crypto.createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${buf.length}\0`), buf])).digest('hex');
const rnd = () => crypto.randomBytes(20).toString('hex');

class MockRepo {
  constructor({ owner = 'test-owner', repo = 'test-repo', token, fixtureDir }) {
    Object.assign(this, { owner, repo, token });
    this.blobs = new Map(); this.trees = new Map(); this.commits = new Map(); this.refs = new Map();
    this.log = [];
    const files = {};
    const walk = (d, rel = '') => {
      for (const n of fs.readdirSync(d)) {
        const p = path.join(d, n), r = rel ? `${rel}/${n}` : n;
        if (fs.statSync(p).isDirectory()) walk(p, r); else files[r] = fs.readFileSync(p);
      }
    };
    // fixtureDir: a directory, or a list of [directory, path prefix] pairs
    if (Array.isArray(fixtureDir)) for (const [d, pre] of fixtureDir) walk(d, pre); else if (fixtureDir) walk(fixtureDir);
    const c = this.commitFiles(files, [], 'fixture');
    this.refs.set('main', c);
  }
  putBlob(buf) { const sha = gitSha(buf); this.blobs.set(sha, buf); return sha; }
  putTree(flat) { const sha = rnd(); this.trees.set(sha, flat); return sha; }
  commitFiles(files, parents, message, baseFlat = {}) {
    const flat = { ...baseFlat };
    for (const [p, v] of Object.entries(files)) {
      if (v === null) delete flat[p]; else flat[p] = this.putBlob(Buffer.isBuffer(v) ? v : Buffer.from(v));
    }
    const sha = rnd();
    this.commits.set(sha, { tree: this.putTree(flat), parents, message });
    return sha;
  }
  // helpers for tests
  head(branch) { return this.refs.get(branch); }
  flat(commitSha) { return this.trees.get(this.commits.get(commitSha).tree); }
  read(branch, p) { const s = this.flat(this.head(branch))[p]; return s ? this.blobs.get(s) : null; }
  readText(branch, p) { const b = this.read(branch, p); return b ? b.toString('utf8') : null; }
  // an outside commit (e.g. a merged PR) on a branch
  pushOutside(branch, files, message = 'outside change') {
    const head = this.head(branch);
    const c = this.commitFiles(files, [head], message, this.flat(head));
    this.refs.set(branch, c);
    return c;
  }
  changedPaths(commitSha) {
    const c = this.commits.get(commitSha);
    const a = c.parents[0] ? this.flat(c.parents[0]) : {}, b = this.flat(commitSha);
    return [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((p) => a[p] !== b[p]);
  }
  commitsAfter(branch, sinceSha) {
    const out = []; let s = this.head(branch);
    while (s && s !== sinceSha) { out.push(s); s = this.commits.get(s).parents[0]; }
    return out;
  }

  async handle(route) {
    const req = route.request();
    const url = new URL(req.url());
    const method = req.method();
    const json = (status, body) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (req.headers()['authorization'] !== `Bearer ${this.token}`) return json(401, { message: 'Bad credentials' });
    const pre = `/repos/${this.owner}/${this.repo}`;
    if (!url.pathname.startsWith(pre)) return json(404, { message: 'Not Found' });
    const p = url.pathname.slice(pre.length);
    const body = req.postData() ? JSON.parse(req.postData()) : null;
    this.log.push(`${method} ${p}`);
    let m;
    if (method === 'GET' && p === '') return json(200, { full_name: `${this.owner}/${this.repo}`, permissions: { push: true } });
    if (method === 'GET' && (m = /^\/git\/ref\/heads\/(.+)$/.exec(p))) {
      const b = decodeURIComponent(m[1]); const s = this.refs.get(b);
      return s ? json(200, { ref: `refs/heads/${b}`, object: { sha: s, type: 'commit' } }) : json(404, { message: 'Not Found' });
    }
    if (method === 'POST' && p === '/git/refs') {
      const b = body.ref.replace('refs/heads/', '');
      if (this.refs.has(b)) return json(422, { message: 'Reference already exists' });
      if (!this.commits.has(body.sha)) return json(422, { message: 'Object does not exist' });
      this.refs.set(b, body.sha); return json(201, { ref: body.ref, object: { sha: body.sha } });
    }
    if (method === 'PATCH' && (m = /^\/git\/refs\/heads\/(.+)$/.exec(p))) {
      const b = decodeURIComponent(m[1]); const cur = this.refs.get(b);
      if (!cur) return json(422, { message: 'Reference does not exist' });
      const c = this.commits.get(body.sha);
      if (!c) return json(422, { message: 'Object does not exist' });
      if (!body.force && !c.parents.includes(cur)) return json(422, { message: 'Update is not a fast forward' });
      this.refs.set(b, body.sha); return json(200, { object: { sha: body.sha } });
    }
    if (method === 'GET' && (m = /^\/git\/commits\/([0-9a-f]+)$/.exec(p))) {
      const c = this.commits.get(m[1]); if (!c) return json(404, { message: 'Not Found' });
      return json(200, { sha: m[1], tree: { sha: c.tree }, parents: c.parents.map((s) => ({ sha: s })), message: c.message });
    }
    if (method === 'GET' && (m = /^\/git\/trees\/([0-9a-f]+)$/.exec(p))) {
      const t = this.trees.get(m[1]); if (!t) return json(404, { message: 'Not Found' });
      return json(200, { sha: m[1], truncated: false, tree: Object.entries(t).map(([path, sha]) => ({ path, mode: '100644', type: 'blob', sha })) });
    }
    if (method === 'GET' && (m = /^\/git\/blobs\/([0-9a-f]+)$/.exec(p))) {
      const b = this.blobs.get(m[1]); if (!b) return json(404, { message: 'Not Found' });
      return json(200, { sha: m[1], encoding: 'base64', content: b.toString('base64').replace(/(.{60})/g, '$1\n') });
    }
    if (method === 'POST' && p === '/git/blobs') {
      const buf = body.encoding === 'base64' ? Buffer.from(body.content, 'base64') : Buffer.from(body.content);
      return json(201, { sha: this.putBlob(buf) });
    }
    if (method === 'POST' && p === '/git/trees') {
      const base = body.base_tree ? this.trees.get(body.base_tree) : {};
      if (!base) return json(422, { message: 'base_tree not found' });
      const flat = { ...base };
      for (const e of body.tree) {
        if (e.sha === null) { if (!(e.path in flat)) return json(422, { message: `path ${e.path} not in tree` }); delete flat[e.path]; }
        else if (e.sha) { if (!this.blobs.has(e.sha)) return json(422, { message: 'blob missing' }); flat[e.path] = e.sha; }
        else flat[e.path] = this.putBlob(Buffer.from(e.content || ''));
      }
      return json(201, { sha: this.putTree(flat) });
    }
    if (method === 'POST' && p === '/git/commits') {
      if (!this.trees.has(body.tree)) return json(422, { message: 'tree missing' });
      const sha = rnd(); this.commits.set(sha, { tree: body.tree, parents: body.parents, message: body.message });
      return json(201, { sha });
    }
    return json(404, { message: `mock: no route ${method} ${p}` });
  }
}
module.exports = { MockRepo, gitSha };

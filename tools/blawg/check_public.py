#!/usr/bin/env python3
"""Privacy check for the public blawg (SCHEMA.md "Privacy"). Python 3 stdlib only.

    python3 tools/blawg/check_public.py                      check the repo
    python3 tools/blawg/check_public.py CHANGESET.json ...   also validate changeset files (.json or .md with front matter)
    python3 tools/blawg/check_public.py --selftest           prove each rule catches a planted problem (fake titles, temp dir)
    options: --root DIR (repo root, default: this script's repo)

Fails (exit 1) if:
  a held title appears anywhere under blawg/ (or in a changeset),
  a piece with state draft is in pieces.json, a connection with state draft is in connections.json,
  a non-live piece's body is a plain .md, a filename is not plain, a .webp exists,
  the data files are malformed, or a changeset op is invalid.

Held titles come from the private project files, which are never in the repo:
  $BLAWG_PRIVATE_DIR, else <repo>/content-private/ (gitignored symlink):
    content.json            held_titles, and titles of pieces marked held / never_public
    directory_seed.json     held_never_public (also looked for at ../map-prototype/web/ next to the private dir, or $BLAWG_SEED)
When none is available the held-title check is skipped (it says so) and every other check still runs.
Held titles are never printed; a hit names the file and the list position only.
"""
import json, os, re, sys, pathlib, unicodedata, tempfile, shutil

ROOT = pathlib.Path(__file__).resolve().parents[2]
TYPES = ['Principle', 'Question', 'Stance', 'Case study', 'Reaction', 'Log', 'Note', 'Door']
STATES = ['seed', 'draft', 'live']
CONN_STATES = ['draft', 'live']
SLUG = re.compile(r'^[a-z0-9]+(?:-[a-z0-9]+)*$')
ART_ID = re.compile(r'^[A-Za-z0-9][A-Za-z0-9._-]*$')
IMG = re.compile(r'^blawg/img/[a-z0-9]+(?:-[a-z0-9]+)*\.(jpg|png)$')
ART_IMG = re.compile(r'^blawg/art/[a-z0-9]+(?:-[a-z0-9]+)*\.(jpg|png)$')
ASCII = re.compile(r'^assets/ascii/[a-z0-9]+(?:-[a-z0-9]+)*\.js(?:#[A-Za-z0-9._-]+)?$')  # optional #Export.key into a catalog file
MD = re.compile(r'^blawg/pieces/([a-z0-9]+(?:-[a-z0-9]+)*)\.md$')
SEG = re.compile(r'^[A-Za-z0-9][A-Za-z0-9._-]*$')  # no spaces or odd characters anywhere under blawg/; img/art/pieces are stricter (lowercase)
TEXT_EXT = {'.json', '.md', '.js', '.html', '.htm', '.css', '.txt', '.enc', '.svg', '.yml', '.yaml', '.xml', ''}
MAX_IMG = 400 * 1024


def norm(t):
    t = unicodedata.normalize('NFKC', t or '').lower()
    t = t.replace('&amp;', '&').replace('’', "'").replace('‘', "'").replace('“', '"').replace('”', '"')
    return re.sub(r'[^a-z0-9&]+', ' ', t).strip()


# ---------------------------------------------------------------- held titles
def held_titles(root):
    """Returns (titles, sources) - titles normalized, never printed."""
    env = os.environ.get('BLAWG_PRIVATE_DIR')
    pdir = pathlib.Path(env) if env else root / 'content-private'
    titles, sources = [], []
    def add(t):
        n = norm(t)
        if len(n) >= 4 and n not in titles: titles.append(n)
    cj = pdir / 'content.json'
    if cj.is_file():
        c = json.loads(cj.read_text(encoding='utf-8'))
        for t in c.get('held_titles') or []: add(t)
        for p in c.get('pieces') or []:
            if p.get('held') or p.get('never_public') or p.get('group') == 'held':
                add(p.get('title')); add(p.get('display_title'))
        sources.append('content.json')
    seeds = [pathlib.Path(os.environ['BLAWG_SEED'])] if os.environ.get('BLAWG_SEED') else []
    seeds += [pdir / 'directory_seed.json', pdir.resolve().parent / 'map-prototype' / 'web' / 'directory_seed.json'] if pdir.exists() else []
    for s in seeds:
        if s.is_file():
            d = json.loads(s.read_text(encoding='utf-8'))
            for h in d.get('held_never_public') or []:
                if isinstance(h, str): add(h)
                else: add(h.get('title')); add(h.get('display_title'))
            sources.append('directory_seed.json')
            break
    return titles, sources


def held_hits(text, titles):
    hay = ' ' + norm(text) + ' '
    return [i + 1 for i, t in enumerate(titles) if ' ' + t + ' ' in hay]


# ---------------------------------------------------------------- repo checks
def load_json(path, errs, dflt):
    if not path.is_file(): return dflt
    try: return json.loads(path.read_text(encoding='utf-8'))
    except Exception as e:
        errs.append(f'{path.name} is not valid JSON ({e})'); return dflt


def check_repo(root, titles):
    errs = []
    blawg = root / 'blawg'
    # .webp anywhere, plain filenames under blawg/
    for p in root.rglob('*'):
        if '.git' in p.parts or 'node_modules' in p.parts: continue
        if p.is_file() and p.suffix.lower() == '.webp': errs.append(f'.webp file: {p.relative_to(root)}')
    files = [p for p in blawg.rglob('*') if p.is_file()] if blawg.is_dir() else []
    for p in files:
        rel = p.relative_to(root).as_posix()
        if not all(SEG.match(s) for s in rel.split('/')): errs.append(f'filename is not plain: {rel}')
        elif rel.startswith('blawg/img/') and not IMG.match(rel): errs.append(f'filename is not plain (blawg/img/<name>.jpg|png): {rel}')
        elif rel.startswith('blawg/art/') and not ART_IMG.match(rel): errs.append(f'filename is not plain (blawg/art/<name>.jpg|png): {rel}')
        elif rel.startswith('blawg/pieces/') and not MD.match(rel): errs.append(f'filename is not plain (blawg/pieces/<id>.md): {rel}')
        if (rel.startswith('blawg/img/') or rel.startswith('blawg/art/')) and p.stat().st_size > MAX_IMG: errs.append(f'image over 400KB: {rel}')
        if titles and p.suffix.lower() in TEXT_EXT:
            for i in held_hits(p.read_text(encoding='utf-8', errors='replace'), titles): errs.append(f'held title #{i} appears in {rel}')
        if titles:
            for i in held_hits(rel.replace('/', ' '), titles): errs.append(f'held title #{i} appears in the path {rel}')
    data = blawg / 'data'
    pieces = load_json(data / 'pieces.json', errs, [])
    conns = load_json(data / 'connections.json', errs, [])
    art = load_json(data / 'art.json', errs, None)
    groups = load_json(data / 'groups.json', errs, [])
    byid = {}
    if not isinstance(pieces, list): errs.append('pieces.json must be a list'); pieces = []
    for p in pieces:
        pid = p.get('id')
        if not isinstance(pid, str) or not SLUG.match(pid): errs.append(f'pieces.json: bad id {pid!r}'); continue
        if pid in byid: errs.append(f'pieces.json: duplicate id {pid}')
        byid[pid] = p
        if p.get('state') == 'draft': errs.append(f'pieces.json: piece with state draft: {pid}')
        elif p.get('state') not in ('live', 'seed'): errs.append(f'pieces.json: bad state {p.get("state")!r} for {pid}')
        if 'bodyText' in p: errs.append(f'pieces.json: {pid} carries bodyText (private field)')
        if p.get('type') is not None and p.get('type') not in TYPES: errs.append(f'pieces.json: bad type {p.get("type")!r} for {pid}')
        if p.get('img') is not None and not IMG.match(str(p.get('img'))): errs.append(f'pieces.json: bad img filename for {pid}')
        if p.get('state') == 'seed' and p.get('body'): errs.append(f'pieces.json: seed {pid} says body:true')
        if p.get('body') and not (blawg / 'pieces' / f'{pid}.md').is_file() and not p.get('locked'): errs.append(f'pieces.json: {pid} says body:true but blawg/pieces/{pid}.md is missing')
    gids = {g.get('id') for g in groups} if isinstance(groups, list) else set()
    for p in byid.values():
        if gids and p.get('group') is not None and p.get('group') not in gids: errs.append(f'pieces.json: unknown group {p.get("group")!r} for {p["id"]}')
    for f in (blawg / 'pieces').glob('*.md') if (blawg / 'pieces').is_dir() else []:
        q = byid.get(f.stem)
        if not q or q.get('state') != 'live' or not q.get('body') or q.get('locked'):
            errs.append(f'body of a non-live piece is a plain .md: blawg/pieces/{f.name}')
    if not isinstance(conns, list): errs.append('connections.json must be a list'); conns = []
    for c in conns:
        if c.get('state') == 'draft': errs.append(f'connections.json: connection with state draft: {c.get("id")}')
        elif c.get('state') != 'live': errs.append(f'connections.json: bad state for {c.get("id")}')
        ends = c.get('ends') or []
        if len(ends) < 2: errs.append(f'connections.json: {c.get("id")} has fewer than 2 ends')
        for e in ends:
            if e not in byid: errs.append(f'connections.json: {c.get("id")} points at {e!r}, which is not a public piece')
    if art is not None:
        for a in (art.get('library') or []):
            src = str(a.get('src'))
            if a.get('kind') == 'ascii' and not ASCII.match(src): errs.append(f'art.json: bad ascii src {src!r}')
            if a.get('kind') == 'img' and not ART_IMG.match(src): errs.append(f'art.json: bad art filename {src!r}')
            if (ASCII.match(src) or ART_IMG.match(src)) and not (root / src.split('#')[0]).is_file(): errs.append(f'art.json: {src} does not exist')
        for pid in ((art.get('assign') or {}).get('piece') or {}):
            if pid not in byid: errs.append(f'art.json: assign.piece names {pid!r}, which is not a public piece')
    de = data / 'drafts.enc'
    if de.is_file():
        try:
            env = json.loads(de.read_text(encoding='utf-8'))
            if env.get('v') != 1 or env.get('kdf') != 'PBKDF2-SHA256' or int(env.get('iter', 0)) < 310000 or not all(env.get(k) for k in ('salt', 'iv', 'ct')) or set(env) - {'v', 'kdf', 'iter', 'salt', 'iv', 'ct'}:
                errs.append('drafts.enc is not the encrypted envelope {v,kdf,iter>=310000,salt,iv,ct}')
        except Exception:
            errs.append('drafts.enc is not valid JSON')
    return errs


# ---------------------------------------------------------------- changesets
def parse_front_matter(text):
    m = re.match(r'^﻿?---\r?\n(.*?)\r?\n---\r?\n?(.*)$', text, re.S)
    if not m: raise ValueError('a .md changeset needs a front-matter header between --- lines')
    meta = {}
    for line in m.group(1).splitlines():
        if not line.strip() or line.strip().startswith('#'): continue
        k = re.match(r'^([A-Za-z_]+)\s*:\s*(.*)$', line)
        if not k: raise ValueError(f'cannot read header line {line!r}')
        v = k.group(2).strip()
        if len(v) >= 2 and v[0] == v[-1] and v[0] in '"\'': v = v[1:-1]
        meta[k.group(1).lower()] = None if v in ('', 'null') else v
    return meta, m.group(2)


def check_changeset(path, root, titles):
    errs = []
    text = pathlib.Path(path).read_text(encoding='utf-8')
    data = root / 'blawg' / 'data'
    pieces = {p['id']: dict(p) for p in (load_json(data / 'pieces.json', errs, []) or []) if isinstance(p, dict) and 'id' in p}
    conns = {c['id']: dict(c) for c in (load_json(data / 'connections.json', errs, []) or []) if isinstance(c, dict) and 'id' in c}
    groups = {g.get('id') for g in (load_json(data / 'groups.json', errs, []) or [])}
    art = load_json(data / 'art.json', errs, None) or {}
    arts = {a.get('id') for a in art.get('library') or []}
    if titles:
        for i in held_hits(text, titles): errs.append(f'held title #{i} appears in this changeset')
    try:
        if str(path).lower().endswith('.md') or text.lstrip().startswith('---'):
            meta, body = parse_front_matter(text)
            pid = meta.get('id')
            if not pid:
                same = [k for k, p in pieces.items() if norm(p.get('title')) == norm(meta.get('title'))]
                pid = same[0] if same else re.sub(r'[^a-z0-9]+', '-', (meta.get('title') or 'piece').lower()).strip('-')
            sett = {k: meta[k] for k in meta if k != 'id'}
            sett['body'] = body
            cs = {'changeset': 1, 'ops': [{'op': 'update' if pid in pieces else 'create', 'kind': 'piece', 'id': pid, 'set': sett}]}
        else:
            cs = json.loads(text)
    except Exception as e:
        return errs + [f'cannot read: {e}']
    if not isinstance(cs, dict): return errs + ['changeset must be a JSON object']
    if cs.get('changeset') != 1: errs.append('"changeset" must be 1')
    if 'author' in cs and cs['author'] not in ('waleed', 'claude', 'warb'): errs.append(f'bad author {cs["author"]!r}')
    for k in cs:
        if k not in ('changeset', 'author', 'note', 'ops', 'files'): errs.append(f'unknown top-level key {k!r}')
    for fp in (cs.get('files') or {}):
        if not (IMG.match(fp) or ART_IMG.match(fp)): errs.append(f'bad filename {fp!r}')
    ops = cs.get('ops')
    if not isinstance(ops, list): return errs + ['"ops" must be a list']
    inside_repo = pathlib.Path(path).resolve().is_relative_to(root.resolve())
    for i, op in enumerate(ops, 1):
        e = []
        if not isinstance(op, dict): errs.append(f'op {i}: not an object'); continue
        kind, oid, sett = op.get('kind'), op.get('id'), op.get('set') or {}
        if op.get('op') == 'assign':
            if kind != 'art': e.append('assign only works on kind "art"')
            if op.get('target') not in ('piece', 'type', 'group', 'gallery'): e.append(f'bad assign target {op.get("target")!r}')
            for a in op.get('art') or []:
                if a not in arts: e.append(f'unknown art id {a!r}')
            if op.get('target') == 'piece' and op.get('key') not in pieces: e.append(f'unknown piece id {op.get("key")!r}')
            if op.get('target') == 'type' and op.get('key') not in TYPES: e.append(f'bad type {op.get("key")!r}')
            if op.get('target') == 'group' and op.get('key') not in groups: e.append(f'unknown group {op.get("key")!r}')
        elif op.get('op') not in ('create', 'update', 'delete'): e.append(f'bad op {op.get("op")!r}')
        elif kind not in ('piece', 'connection', 'art'): e.append(f'bad kind {kind!r}')
        elif not isinstance(oid, str) or not (ART_ID if kind == 'art' else SLUG).match(oid): e.append(f'bad id {oid!r}')
        elif kind == 'piece':
            if op['op'] == 'create' and oid in pieces: e.append(f'id {oid!r} already exists')
            if op['op'] in ('update', 'delete') and oid not in pieces: e.append(f'unknown piece id {oid!r}')
            for k in sett:
                if k not in ('title', 'desc', 'group', 'type', 'state', 'body', 'img', 'art'): e.append(f'unknown piece field {k!r}')
            if op['op'] == 'create' and not str(sett.get('title') or '').strip(): e.append('a new piece needs a title')
            if 'title' in sett:
                dup = [k for k, p in pieces.items() if k != oid and norm(p.get('title')) == norm(sett['title'])]
                if dup: e.append(f'duplicate title: same as piece {dup[0]!r}')
            if sett.get('group') is not None and 'group' in sett and sett['group'] not in groups: e.append(f'bad group {sett["group"]!r}')
            if sett.get('type') is not None and sett['type'] not in TYPES: e.append(f'bad type {sett["type"]!r}')
            if 'state' in sett and sett['state'] not in STATES: e.append(f'bad state {sett["state"]!r}')
            if sett.get('img') is not None and not IMG.match(str(sett['img'])): e.append(f'bad image filename {sett["img"]!r}')
            state = sett.get('state', pieces.get(oid, {}).get('state', 'draft'))
            if inside_repo and (state == 'draft' or (state == 'seed' and str(sett.get('body') or '').strip())):
                e.append('draft content in a changeset committed to the public repo (drafts belong only in drafts.enc; import it in the editor instead)')
            if not e:
                if op['op'] == 'delete':
                    pieces.pop(oid, None)
                    for cid, c in list(conns.items()):
                        if oid in c.get('ends', []):
                            c['ends'] = [x for x in c['ends'] if x != oid]
                            if len(c['ends']) < 2: conns.pop(cid)
                else:
                    pieces.setdefault(oid, {'id': oid}).update({k: v for k, v in sett.items() if k != 'body'})
        elif kind == 'connection':
            if op['op'] == 'create' and oid in conns: e.append(f'connection id {oid!r} already exists')
            if op['op'] in ('update', 'delete') and oid not in conns: e.append(f'unknown connection id {oid!r}')
            for k in sett:
                if k not in ('ends', 'text', 'label', 'state'): e.append(f'unknown connection field {k!r}')
            if op['op'] == 'create' and 'ends' not in sett: e.append('a connection needs ends')
            if 'ends' in sett:
                ends = sett['ends'] if isinstance(sett['ends'], list) else []
                if len(ends) < 2: e.append('a connection needs 2 or more ends')
                for x in ends:
                    if x not in pieces: e.append(f'connection to unknown or deleted piece {x!r}')
            if 'state' in sett and sett['state'] not in CONN_STATES: e.append(f'bad connection state {sett["state"]!r}')
            if inside_repo and sett.get('state', conns.get(oid, {}).get('state', 'draft')) == 'draft' and op['op'] != 'delete':
                e.append('draft connection in a changeset committed to the public repo')
            if not e:
                if op['op'] == 'delete': conns.pop(oid, None)
                else: conns.setdefault(oid, {'id': oid}).update(sett)
        else:
            if op['op'] == 'create' and oid in arts: e.append(f'art id {oid!r} already exists')
            if op['op'] in ('update', 'delete') and oid not in arts: e.append(f'unknown art id {oid!r}')
            src, k = sett.get('src'), sett.get('kind')
            if src is not None:
                if k == 'ascii' and not ASCII.match(str(src)): e.append(f'bad ascii src {src!r}')
                if k != 'ascii' and not ART_IMG.match(str(src)): e.append(f'bad art filename {src!r}')
            if not e:
                if op['op'] == 'delete': arts.discard(oid)
                else: arts.add(oid)
        errs += [f'op {i}: {x}' for x in e]
    return errs


# ---------------------------------------------------------------- main / selftest
def run(root, changesets, quiet=False):
    titles, sources = held_titles(root)
    out = (lambda *a: None) if quiet else print
    if sources: out(f'held-title check: {len(titles)} held titles from {", ".join(sources)}')
    else: out('held-title check SKIPPED: no private source (set BLAWG_PRIVATE_DIR or add the content-private/ symlink); other checks still run')
    errs = check_repo(root, titles)
    for cs in changesets:
        errs += [f'{cs}: {e}' for e in check_changeset(cs, root, titles)]
    for e in errs: out('FAIL ' + e)
    out('blawg public check: ' + ('OK' if not errs else f'{len(errs)} problem(s)'))
    return errs


def selftest():
    ok = True
    def expect(name, errs, pattern):
        nonlocal ok
        hit = any(re.search(pattern, e) for e in errs)
        print(('ok   ' if hit else 'FAIL ') + name)
        ok = ok and hit
    tmp = pathlib.Path(tempfile.mkdtemp(prefix='blawg-selftest-'))
    try:
        priv = tmp / 'private'; priv.mkdir()
        (priv / 'content.json').write_text(json.dumps({'held_titles': ['Fake held title omega'], 'pieces': [{'title': 'Fake never public sigma', 'never_public': True}]}))
        (priv / 'directory_seed.json').write_text(json.dumps({'held_never_public': [{'title': 'Fake seed held kappa', 'display_title': 'Fake kappa'}]}))
        os.environ['BLAWG_PRIVATE_DIR'] = str(priv)
        os.environ.pop('BLAWG_SEED', None)
        def fresh():
            r = tmp / 'repo'
            if r.exists(): shutil.rmtree(r)
            (r / 'blawg' / 'data').mkdir(parents=True); (r / 'blawg' / 'pieces').mkdir(); (r / 'assets' / 'ascii').mkdir(parents=True)
            (r / 'assets' / 'ascii' / 'fake-tree.js').write_text('//fake\n')
            (r / 'blawg' / 'data' / 'groups.json').write_text(json.dumps([{'id': 'alpha', 'name': 'Fake group', 'order': 1, 'accent': 'orange', 'art': None}]))
            (r / 'blawg' / 'data' / 'pieces.json').write_text(json.dumps([
                {'id': 'fake-live', 'title': 'Fake live piece', 'desc': 'fake', 'group': 'alpha', 'type': 'Note', 'state': 'live', 'art': [], 'img': None, 'locked': False, 'body': True},
                {'id': 'fake-seed', 'title': 'Fake seed piece', 'desc': 'fake', 'group': 'alpha', 'type': None, 'state': 'seed', 'art': [], 'img': None, 'locked': False, 'body': False}]))
            (r / 'blawg' / 'data' / 'connections.json').write_text(json.dumps([{'id': 'lk-001', 'ends': ['fake-live', 'fake-seed'], 'text': '', 'label': '', 'state': 'live'}]))
            (r / 'blawg' / 'data' / 'art.json').write_text(json.dumps({'library': [{'id': 'fake-tree', 'name': 'Fake tree', 'kind': 'ascii', 'src': 'assets/ascii/fake-tree.js'}], 'assign': {'piece': {}, 'type': {}, 'group': {}}, 'gallery': []}))
            (r / 'blawg' / 'data' / 'drafts.enc').write_text(json.dumps({'v': 1, 'kdf': 'PBKDF2-SHA256', 'iter': 310000, 'salt': 'AAAA', 'iv': 'AAAA', 'ct': 'AAAA'}))
            (r / 'blawg' / 'pieces' / 'fake-live.md').write_text('Fake body.\n')
            return r
        r = fresh()
        base = run(r, [], quiet=True)
        print(('ok   ' if not base else 'FAIL ') + 'clean fake repo passes' + ('' if not base else f' ({base})'))
        ok = ok and not base
        r = fresh(); p = r / 'blawg' / 'data' / 'pieces.json'
        d = json.loads(p.read_text()); d[1]['desc'] = 'mentions the FAKE held-title Omega here'; p.write_text(json.dumps(d))
        expect('planted held title (content.json held_titles) in pieces.json', run(r, [], True), r'held title #1 appears in blawg/data/pieces.json')
        r = fresh(); (r / 'blawg' / 'notes.md').write_text('x fake never public sigma x')
        expect('planted never_public title in another file', run(r, [], True), r'held title #\d appears in blawg/notes\.md')
        r = fresh(); (r / 'blawg' / 'index.html').write_text('<p>Fake seed held kappa</p>')
        expect('planted seed held_never_public title', run(r, [], True), r'held title #\d appears in blawg/index\.html')
        r = fresh(); d = json.loads(p.read_text()); d[1]['state'] = 'draft'; p.write_text(json.dumps(d))
        expect('draft piece in pieces.json', run(r, [], True), r'state draft: fake-seed')
        r = fresh(); c = r / 'blawg' / 'data' / 'connections.json'; d = json.loads(c.read_text()); d[0]['state'] = 'draft'; c.write_text(json.dumps(d))
        expect('draft connection in connections.json', run(r, [], True), r'connection with state draft')
        r = fresh(); (r / 'blawg' / 'pieces' / 'fake-seed.md').write_text('unapproved fake body')
        expect('seed body as plain .md', run(r, [], True), r'non-live piece is a plain \.md: blawg/pieces/fake-seed\.md')
        r = fresh(); (r / 'blawg' / 'img').mkdir(); (r / 'blawg' / 'img' / 'Fake Photo.JPG').write_bytes(b'\xff\xd8')
        expect('filename not plain', run(r, [], True), r'filename is not plain')
        r = fresh(); (r / 'blawg' / 'art').mkdir(); (r / 'blawg' / 'art' / 'fake.webp').write_bytes(b'RIFF')
        expect('.webp exists', run(r, [], True), r'\.webp file')
        r = fresh(); (r / 'blawg' / 'data' / 'drafts.enc').write_text(json.dumps({'pieces': [{'title': 'plain'}]}))
        expect('drafts.enc not encrypted', run(r, [], True), r'drafts\.enc is not the encrypted envelope')
        r = fresh(); cs = tmp / 'cs.json'
        cs.write_text(json.dumps({'changeset': 1, 'author': 'warb', 'ops': [
            {'op': 'update', 'kind': 'piece', 'id': 'nope', 'set': {'desc': 'x'}},
            {'op': 'create', 'kind': 'piece', 'id': 'fake-dup', 'set': {'title': 'Fake live piece', 'group': 'alpha', 'state': 'live'}},
            {'op': 'create', 'kind': 'piece', 'id': 'fake-enum', 'set': {'title': 'Fake enum', 'group': 'zzz', 'type': 'Essay', 'state': 'gone'}},
            {'op': 'delete', 'kind': 'piece', 'id': 'fake-seed'},
            {'op': 'create', 'kind': 'connection', 'id': 'lk-002', 'set': {'ends': ['fake-live', 'fake-seed'], 'state': 'live'}},
            {'op': 'update', 'kind': 'piece', 'id': 'fake-live', 'set': {'img': 'blawg/img/Bad.webp'}}]}))
        errs = check_changeset(cs, r, held_titles(r)[0])
        for name, pat in [('changeset: unknown id', r'unknown piece id .nope.'), ('changeset: duplicate title', r'duplicate title'), ('changeset: bad group', r'bad group'),
                          ('changeset: bad type', r'bad type'), ('changeset: bad state', r'bad state'), ('changeset: connection to deleted piece', r"deleted piece 'fake-seed'"),
                          ('changeset: bad filename', r'bad image filename')]:
            expect(name, errs, pat)
        good = tmp / 'good.md'
        good.write_text('---\ntitle: Fake new live piece\ngroup: alpha\ntype: Note\nstate: live\n---\nFake body.\n')
        e2 = check_changeset(good, r, held_titles(r)[0])
        print(('ok   ' if not e2 else 'FAIL ') + 'valid .md changeset passes' + ('' if not e2 else f' ({e2})')); ok = ok and not e2
        leak = tmp / 'leak.md'
        leak.write_text('---\ntitle: Fake held title omega\ngroup: alpha\nstate: live\n---\nx\n')
        expect('changeset carrying a held title', check_changeset(leak, r, held_titles(r)[0]), r'held title #1 appears in this changeset')
        incs = r / 'blawg' / 'changesets'; incs.mkdir(); (incs / 'pr.json').write_text(json.dumps({'changeset': 1, 'ops': [{'op': 'create', 'kind': 'piece', 'id': 'fake-d', 'set': {'title': 'Fake draft d', 'state': 'draft'}}]}))
        expect('draft content in a changeset inside the public repo', check_changeset(incs / 'pr.json', r, []), r'draft content in a changeset')
        os.environ.pop('BLAWG_PRIVATE_DIR')
        os.environ['BLAWG_PRIVATE_DIR'] = str(tmp / 'missing')
        r = fresh(); t, s = held_titles(r)
        print(('ok   ' if not s and not run(r, [], True) else 'FAIL ') + 'no private source: skipped, other checks still run'); ok = ok and not s
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
        os.environ.pop('BLAWG_PRIVATE_DIR', None)
    print('selftest: ' + ('OK' if ok else 'FAILED'))
    return ok


def main(argv):
    root, args = ROOT, []
    it = iter(argv)
    for a in it:
        if a == '--selftest': return 0 if selftest() else 1
        if a == '--root': root = pathlib.Path(next(it)).resolve()
        elif a in ('-h', '--help'): print(__doc__); return 0
        else: args.append(a)
    return 1 if run(root, args) else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))

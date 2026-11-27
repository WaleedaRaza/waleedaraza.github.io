"""Public cut of the blawg: reads the private content and writes what visitors may see.

    python3 tools/blawg/build_public.py                 write blawg/data.js (public) and content-private/preview/ (private)
    python3 tools/blawg/build_public.py --dry-run       check and print the manifest, write nothing
    python3 tools/blawg/build_public.py --selftest      dry runs that prove the filters and leak checks work
    options: --content <content.json> (default content-private/content.json)

What ships:
  a piece   only if visibility is public, and it is not held and not never_public;
            its body and sources only if it is also approved, otherwise title, desc and state only.
  a link    only if its author is "me" and both ends ship; a quote is kept only where that end's body ships.
  a thread  only its stops that ship; dropped if fewer than two stops are left.
  a term    only if its visibility is public; appears_in keeps only pieces that ship.
  a group   only if at least one piece in it ships.
Never ships: held titles, loose lines from the old holes, private pieces, unapproved bodies.
Any of those found in the output stops the build with an error, and nothing is written.
"""
import json, re, sys, hashlib, pathlib, unicodedata, datetime, copy

ROOT = pathlib.Path(__file__).resolve().parents[2]
APP = ROOT / 'blawg' / 'index.html'
PUBLIC_DATA = ROOT / 'blawg' / 'data.js'


def norm(t):
    t = unicodedata.normalize('NFKC', t or '').lower()
    t = t.replace('&amp;', '&').replace('’', "'").replace('‘', "'").replace('“', '"').replace('”', '"')
    return re.sub(r'[^a-z0-9&]+', ' ', t).strip()


def ships(p):
    return p.get('visibility') == 'public' and not p.get('held') and not p.get('never_public') and p.get('group') != 'held'


def cut(C):
    held_norm = {norm(t) for t in C.get('held_titles') or []}
    pub = {}
    for p in C['pieces']:
        if not ships(p): continue
        if norm(p['title']) in held_norm or norm(p.get('display_title')) in held_norm: continue  # held by title even if the flag was lost
        q = {k: p[k] for k in ('id', 'title', 'display_title', 'group', 'desc', 'type', 'role', 'state', 'created', 'updated') if p.get(k) is not None}
        q['comes'] = list(p.get('comes') or [])
        q['visibility'] = 'public'
        if p.get('special') == 'directory_intro': q['special'] = 'directory_intro'
        if p.get('approved') and p.get('body'):
            q['body'] = list(p['body']); q['sources'] = list(p.get('sources') or []); q['approved'] = True
        else:
            q['approved'] = False
        pub[p['id']] = q
    groups = [dict(g) for g in C['groups'] if any(q['group'] == g['id'] for q in pub.values())]
    links = []
    for r in C['links']:
        if r.get('author') != 'me' or r['source'] not in pub or r['target'] not in pub: continue
        l = {k: r.get(k) for k in ('id', 'source', 'from_q', 'target', 'to_q', 'type', 'author', 'reason', 'text', 'created', 'updated')}
        if 'body' not in pub[r['source']]: l['from_q'] = ''
        if 'body' not in pub[r['target']]: l['to_q'] = None
        links.append(l)
    used_types = {l['type'] for l in links}
    threads = []
    for t in C.get('threads') or []:
        path = [s for s in t['path'] if s in pub]
        if len(path) >= 2: threads.append({'id': t['id'], 'name': t['name'], 'about': t.get('about') or '', 'path': path})
    terms = [{'id': t['id'], 'term': t['term'], 'definition': t.get('definition'), 'appears_in': [a for a in t.get('appears_in') or [] if a in pub],
              'visibility': 'public', 'updated': t.get('updated')} for t in C.get('terms') or [] if t.get('visibility') == 'public']
    site = C.get('site') or {}
    out = {
        'blawg': C.get('blawg', '0.2'), 'cut': 'public',
        'site': {'title': site.get('title') or 'Blawg', 'intro': list(site.get('intro') or [])},
        'piece_types': C.get('piece_types'), 'roles': C.get('roles') or {}, 'audiences': C.get('audiences') or [],
        'groups': groups, 'pieces': [pub[p['id']] for p in C['pieces'] if p['id'] in pub],
        'links': links, 'types': [t for t in C.get('types') or [] if t['id'] in used_types],
        'threads': threads, 'terms': terms,
    }
    return out


def strings(o):
    if isinstance(o, str): yield o
    elif isinstance(o, dict):
        for v in o.values(): yield from strings(v)
    elif isinstance(o, list):
        for v in o: yield from strings(v)


def sentences(par):
    return [s.strip() for s in re.split(r'(?<=[.!?])\s+', par) if len(s.strip()) >= 40]


def leaks(C, out, extra_texts):
    """Every reason the output must not ship. Empty list means clean."""
    bad = []
    shipped = {p['id'] for p in out['pieces']}
    shipped_body = {p['id'] for p in out['pieces'] if p.get('body')}
    vals = list(strings(out))
    blob_norm = ' ' + norm(' \n '.join(vals + extra_texts)) + ' '
    raw = '\n'.join(vals + extra_texts)
    vals_set = set(vals)
    if out.get('cut') != 'public': bad.append('the output is not marked as the public cut')
    for k in ('held_titles', 'loose_lines'):
        if k in out: bad.append('the output carries %s' % k)
    for t in C.get('held_titles') or []:
        if norm(t) and (' ' + norm(t) + ' ') in blob_norm: bad.append('held title in the output: "%s"' % t)
    for p in C['pieces']:
        if (p.get('held') or p.get('never_public')) and p['id'] in shipped: bad.append('held or never-public piece ships: %s' % p['id'])
        if p['id'] in shipped: continue
        for t in {p['title'], p.get('display_title') or p['title']}:
            if t in vals_set or (len(t) >= 12 and t in raw): bad.append('private piece title in the output: "%s" (%s)' % (t, p['id']))
        if p['id'] in vals_set: bad.append('private piece id in the output: %s' % p['id'])
    for p in C['pieces']:
        if p['id'] in shipped_body and p.get('approved'): continue
        for par in p.get('body') or []:
            if len(par) >= 25 and par in raw: bad.append('unapproved paragraph from %s in the output: "%s..."' % (p['id'], par[:50]))
            else:
                for s in sentences(par):
                    if s in raw: bad.append('unapproved sentence from %s in the output: "%s..."' % (p['id'], s[:50])); break
    shipped_text = '\n'.join(b for p in out['pieces'] for b in p.get('body') or [])
    for l in C.get('loose_lines') or []:
        if len(l['text']) >= 25 and l['text'] in raw and l['text'] not in shipped_text: bad.append('loose line from the old holes in the output: "%s..."' % l['text'][:50])
    for p in out['pieces']:
        if p.get('body') and not next((q for q in C['pieces'] if q['id'] == p['id'] and q.get('approved')), None): bad.append('body ships without approval: %s' % p['id'])
    for l in out['links']:
        if l['author'] != 'me' or l['source'] not in shipped or l['target'] not in shipped: bad.append('link ships that should not: %s' % l['id'])
    return sorted(set(bad))


def manifest(C, out, version, wrote):
    P = out['pieces']
    nb = [p for p in P if p.get('body')]
    L = ['# Public cut manifest', '', 'Built %s from %d private pieces. Version %s.' % (
        datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0).isoformat().replace('+00:00', 'Z'), len(C['pieces']), version), '',
        'Ships: %d pieces (%d with body, %d title, desc and state only), %d groups, %d links, %d threads, %d terms, site intro %d paragraphs.' % (
            len(P), len(nb), len(P) - len(nb), len(out['groups']), len(out['links']), len(out['threads']), len(out['terms']), len(out['site']['intro'])),
        'Withheld: %d private pieces, %d held, %d bodies not approved, %d links not by me or with a private end, %d loose lines.' % (
            sum(1 for p in C['pieces'] if p.get('visibility') != 'public'), sum(1 for p in C['pieces'] if p.get('held')),
            sum(1 for p in C['pieces'] if p.get('body') and not (p.get('approved') and p['id'] in {q['id'] for q in nb})),
            len(C['links']) - len(out['links']), len(C.get('loose_lines') or [])),
        'Leak checks: held titles, private titles and ids, unapproved paragraphs and sentences, loose lines. All clean.', '']
    for g in out['groups']:
        L.append('## %s' % g['name'])
        for p in P:
            if p['group'] == g['id']: L.append('- %s (`%s`) · %s%s' % (p.get('display_title') or p['title'], p['id'], p.get('state'), ' · body' if p.get('body') else ''))
        L.append('')
    if wrote: L += ['Wrote:'] + ['- ' + w for w in wrote] + ['']
    else: L += ['Dry run: nothing written.', '']
    return '\n'.join(L)


def datajs(obj):
    return 'window.BLAWG_DATA = ' + json.dumps(obj, ensure_ascii=False, separators=(',', ':')) + ';\n'


def build(C, dry, content_dir, quiet=False):
    out = cut(C)
    version = hashlib.sha256(json.dumps(out, ensure_ascii=False, sort_keys=True).encode()).hexdigest()[:12]
    out['version'] = version
    app = APP.read_text(encoding='utf-8')
    bad = leaks(C, out, [app])
    if bad:
        raise SystemExit('PUBLIC CUT REFUSED. Nothing was written.\n' + '\n'.join('  - ' + b for b in bad))
    wrote = []
    if not dry:
        PUBLIC_DATA.write_text(datajs(out), encoding='utf-8'); wrote.append(str(PUBLIC_DATA.relative_to(ROOT)))
        prev = content_dir / 'preview'; prev.mkdir(exist_ok=True)
        full = copy.deepcopy(C); full['cut'] = 'private'
        full['version'] = hashlib.sha256(json.dumps(C, ensure_ascii=False, sort_keys=True).encode()).hexdigest()[:12]
        (prev / 'index.html').write_text(app, encoding='utf-8'); (prev / 'data.js').write_text(datajs(full), encoding='utf-8')
        wrote += [str(prev / 'index.html'), str(prev / 'data.js')]
    m = manifest(C, out, version, wrote)
    if not dry: (content_dir / 'public-manifest.md').write_text(m, encoding='utf-8')
    if not quiet: print(m)
    return out, m


def selftest(C, content_dir):
    ok = True
    def check(name, cond):
        nonlocal ok; ok &= bool(cond); print(('PASS ' if cond else 'FAIL ') + name)
    out, _ = build(C, True, content_dir, quiet=True)
    check('real data: every piece is private, so nothing ships', len(out['pieces']) == sum(1 for p in C['pieces'] if ships(p)))
    T = copy.deepcopy(C)
    for p in T['pieces']: p['visibility'] = 'public'
    out, _ = build(T, True, content_dir, quiet=True)
    ids = {p['id'] for p in out['pieces']}
    check('all set public: no held or never-public piece ships', not any(p['id'] in ids for p in T['pieces'] if p.get('held') or p.get('never_public')))
    check('all set public: no unapproved body ships', not any(p.get('body') for p in out['pieces']))
    check('all set public: no proposed link ships', not out['links'])
    print('     (all set public would ship %d of %d pieces)' % (len(out['pieces']), len(T['pieces'])))
    A = copy.deepcopy(T)
    bodied = [p for p in A['pieces'] if p.get('body') and ships(p)][:3]
    for p in bodied: p['approved'] = True
    if len(bodied) >= 2:
        A['links'].append({'id': 'lk-test', 'source': bodied[0]['id'], 'from_q': bodied[0]['body'][0][:30], 'target': bodied[1]['id'], 'to_q': None,
                           'type': A['types'][0]['id'], 'author': 'me', 'reason': '', 'text': 'test bridge', 'created': None, 'updated': None})
    out, _ = build(A, True, content_dir, quiet=True)
    check('three approved: exactly their bodies ship', sorted(p['id'] for p in out['pieces'] if p.get('body')) == sorted(p['id'] for p in bodied))
    check('a bridge by me between two shipped pieces ships', len(bodied) < 2 or any(l['id'] == 'lk-test' for l in out['links']))
    # inject leaks into a cut and confirm the checks catch them
    out = cut(T)
    secret = next(p for p in T['pieces'] if p.get('body'))
    out['pieces'].append({'id': 'x', 'title': 'x', 'desc': secret['body'][0], 'group': 'x'})
    check('an unapproved paragraph smuggled into a desc is caught', any('unapproved' in b for b in leaks(T, out, [])))
    out = cut(T)
    if T.get('held_titles'):
        out['site']['intro'] = ['Coming soon: ' + T['held_titles'][0].upper()]
        check('a held title in the intro is caught, even in capitals', any('held title' in b for b in leaks(T, out, [])))
    out = cut(C)
    check('a private title hidden in the page code is caught', any('private piece title' in b for b in leaks(C, out, ['<b>' + C['pieces'][0]['title'] + '</b>'])))
    print('SELFTEST ' + ('PASSED' if ok else 'FAILED'))
    return ok


def main(argv):
    content = ROOT / 'content-private' / 'content.json'
    if '--content' in argv: content = pathlib.Path(argv[argv.index('--content') + 1])
    C = json.loads(content.read_text(encoding='utf-8'))
    if C.get('cut') != 'private': sys.exit('%s is not the private content (cut is %r).' % (content, C.get('cut')))
    if '--selftest' in argv: sys.exit(0 if selftest(C, content.parent) else 1)
    build(C, '--dry-run' in argv, content.parent)


if __name__ == '__main__':
    main(sys.argv[1:])

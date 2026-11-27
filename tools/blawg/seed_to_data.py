"""Wipe the blawg down to the seed: write blawg/data/*.json from directory_seed.json.

    python3 tools/blawg/seed_to_data.py --seed <directory_seed.json> --art-from <old posts.js> [--dry-run]

What it writes (see blawg/data/README.md):
  groups.json       the 12 groups ("How I think" merged into Ponderings), order, accent
  pieces.json       every public seed title with its desc line, state "seed", no body
  connections.json  only Waleed's real links (today: Libxndr <-> Information Age and Knowledgemaxing), text left empty for him
  art.json          the ASCII library and the art he assigned on the old board (by title)
Never written: held titles (the seed's held_never_public list), pieces marked private_never_public, old bodies, proposed links.
"""
import json, re, sys, argparse, pathlib, unicodedata

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / 'blawg' / 'data'
TYPES = ['Principle', 'Question', 'Stance', 'Case study', 'Reaction', 'Log', 'Note', 'Door']


def norm(t):
    t = unicodedata.normalize('NFKC', t or '').lower().replace('’', "'")
    return re.sub(r'[^a-z0-9]+', ' ', t.replace("'", '')).strip()


def slug(t):
    return re.sub(r'-+', '-', re.sub(r'[^a-z0-9]+', '-', norm(t))).strip('-')[:60].rstrip('-')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--seed', required=True)
    ap.add_argument('--art-from', help='old blawg/posts.js (commit 177c229) whose art keys he assigned')
    ap.add_argument('--dry-run', action='store_true')
    a = ap.parse_args()
    S = json.load(open(a.seed, encoding='utf-8'))
    held = {norm(t if isinstance(t, str) else t.get('title')) for t in S.get('held_never_public') or []}
    groups = sorted(S['groups'], key=lambda g: g['order'])
    # his merge (2026-11-27): Ponderings + How I think become one group
    groups = [dict(g) for g in groups if g['id'] != 'pond']
    for n, g in enumerate(groups):
        g['order'] = n + 1
        if g['id'] == 'think': g['name'] = 'Ponderings, thought experiments, and how I think'
    out_g = [{'id': g['id'], 'name': g['name'], 'order': g['order'], 'accent': 'orange' if g['order'] % 2 else 'teal', 'art': None} for g in groups]
    gids = {g['id'] for g in out_g}
    pieces, seen = [], set()
    for p in S['pieces']:
        if p.get('special') == 'private_never_public': continue
        t = p.get('display_title') or p['title']
        if norm(t) in held or norm(p['title']) in held: continue
        g = 'think' if p['group'] == 'pond' else p['group']
        assert g in gids, g
        pid = slug(t); k = 2
        while pid in seen: pid = slug(t) + '-' + str(k); k += 1
        seen.add(pid)
        pieces.append({'id': pid, 'title': t, 'desc': p.get('desc') or '', 'group': g, 'type': None, 'state': 'seed',
                       'art': [], 'img': None, 'locked': False, 'body': False})
    # art he assigned on the old board, matched by title
    assign, used = {}, set()
    if a.art_from:
        art = {}
        for l in open(a.art_from, encoding='utf-8'):
            l = l.strip().rstrip(',')
            if l.startswith('{"n"'):
                r = json.loads(l)
                if r.get('art'): art[norm(r['title'])] = r['art']
        for p in pieces:
            k = art.get(norm(p['title']))
            if k: p['art'] = [k]; assign[p['id']] = [k]; used.add(k)
    for p in pieces:
        for name in ('libxndr', 'warb', 'pokeraio'):
            if p['title'].lower().startswith(name): p['img'] = 'blawg/img/%s.jpg' % name
    # the ASCII library, in catalog order
    cat = (ROOT / 'assets' / 'ascii' / 'catalog.js').read_text(encoding='utf-8')
    lib = [{'id': m.group(1), 'name': m.group(2), 'kind': 'ascii', 'src': 'assets/ascii/catalog.js#' + m.group(1)}
           for m in re.finditer(r"\[\s*'([A-Za-z0-9]+\.[A-Za-z0-9_.-]+)'\s*,\s*'((?:[^'\\]|\\.)*)'", cat[cat.index('var L = ['):])]
    keys = {x['id'] for x in lib}
    missing = sorted(used - keys)
    art_json = {'library': lib, 'assign': {'piece': assign, 'type': {}, 'group': {}}, 'gallery': [x['id'] for x in lib]}
    # his one real link
    def find(sub):
        m = [p for p in pieces if sub.lower() in p['title'].lower()]
        assert len(m) == 1, (sub, [p['title'] for p in m]); return m[0]['id']
    conns = [{'id': 'lk-001', 'ends': [find('Libxndr'), find('Knowledgemaxing')], 'text': '', 'label': '', 'state': 'live'}]
    print('%d groups, %d pieces (%d with art, %d with pictures), %d connection, %d artworks in the library%s' % (
        len(out_g), len(pieces), len(assign), sum(1 for p in pieces if p['img']), len(conns), len(lib),
        ('; art keys not in the catalog: ' + ', '.join(missing)) if missing else ''))
    if a.dry_run: return
    OUT.mkdir(parents=True, exist_ok=True)
    def w(name, obj): (OUT / name).write_text(json.dumps(obj, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    w('groups.json', out_g); w('pieces.json', pieces); w('connections.json', conns); w('art.json', art_json)


if __name__ == '__main__':
    main()

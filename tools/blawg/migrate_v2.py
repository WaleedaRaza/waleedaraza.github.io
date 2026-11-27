"""One-time migration of the Blawg Web map (Blawg Script 0.1 data) to the 0.2 content model.

    python3 tools/blawg/migrate_v2.py <old map-graph.json> <old map-rel.json> <directory_seed.json> <out dir>

Writes <out dir>/content.json (the full private content) and <out dir>/migration-report.md.
The out dir must be content-private/ (gitignored); nothing this writes belongs in the public repo.

Rules: prose is copied byte for byte (bodies, quotes, reasons, wall lines, desc lines, titles).
Every piece starts private. Held titles are flagged and can never ship.
"""
import json, re, sys, unicodedata, datetime, pathlib

TYPES = ['Principle', 'Question', 'Stance', 'Case study', 'Reaction', 'Log', 'Note', 'Door']


def norm(t):
    t = unicodedata.normalize('NFKC', t or '').lower()
    t = re.sub(r'^(untitled|new):\s*', '', t)
    t = re.sub(r'^\(loose line on the board:\s*"?(.*?)"?\)$', r'\1', t)
    t = t.replace('&amp;', '&').replace('’', "'").replace('‘', "'").replace('“', '"').replace('”', '"')
    return re.sub(r'[^a-z0-9&]+', ' ', t).strip()


def slug(t, taken):
    s = re.sub(r'[^a-z0-9]+', '-', unicodedata.normalize('NFKD', norm((t or '').replace("'", '').replace('\u2019', ''))).encode('ascii', 'ignore').decode()).strip('-')[:48].strip('-') or 'piece'
    base, k = s, 2
    while s in taken:
        s = (base[:44] + '-' + str(k)); k += 1
    taken.add(s)
    return s


def main(graph_p, rel_p, seed_p, out_d):
    G = json.load(open(graph_p, encoding='utf-8'))
    X = json.load(open(rel_p, encoding='utf-8'))
    S = json.load(open(seed_p, encoding='utf-8'))
    now = datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0).isoformat().replace('+00:00', 'Z')
    out = pathlib.Path(out_d); out.mkdir(parents=True, exist_ok=True)

    groups = [{'id': g['id'], 'name': g['name'], 'order': g['order']} for g in sorted(S['groups'], key=lambda g: g['order'])]
    gids = {g['id'] for g in groups}

    # his loose lines on the old holes are prose: keep them, even though the holes go away
    loose = []
    for h in G['holes']:
        if h.get('line'): loose.append({'from_hole': h['id'], 'kind': 'line', 'text': h['line']})
        for w in h.get('wall') or []: loose.append({'from_hole': h['id'], 'kind': 'wall', 'text': w})

    by_exact, by_norm = {}, {}
    for n in G['nodes']:
        for t in (n['title'], n.get('display_title') or n['title']):
            by_exact.setdefault(t, n['id']); by_norm.setdefault(norm(t), n['id'])
    node = {n['id']: n for n in G['nodes']}
    taken = set(node)

    pieces, placed, rep_exact, rep_norm, rep_created, rep_notes = {}, {}, [], [], [], []

    def convert(n):
        p = {'id': n['id'], 'title': n['title']}
        if n.get('display_title') and n['display_title'] != n['title']: p['display_title'] = n['display_title']
        p['group'] = None
        p['desc'] = ''
        p['type'] = n.get('kind') if n.get('kind') in TYPES else None
        p['role'] = n.get('role') or 'room'
        p['comes'] = n.get('comes') or []
        if n.get('body'): p['body'] = n['body']
        p['sources'] = n.get('sources') or []
        p['approved'] = bool(n.get('approved'))
        p['state'] = 'written' if n.get('body') else 'planned'
        p['visibility'] = 'private'
        p['held'] = False
        p['never_public'] = False
        p['special'] = None
        p['created'] = None
        p['updated'] = None
        if n.get('kind') and n.get('kind') not in TYPES: p['legacy_kind'] = n['kind']
        return p

    for sp in S['pieces']:
        nid = by_exact.get(sp['title']) or by_exact.get(sp['display_title'])
        how = 'exact'
        if not nid:
            nid = by_norm.get(norm(sp['title'])) or by_norm.get(norm(sp['display_title'])); how = 'normalised'
        if nid and nid in placed:
            rep_notes.append('Seed title "%s" matched %s, which an earlier seed title already took; created a new piece instead.' % (sp['title'], nid)); nid = None
        if nid:
            p = convert(node[nid]); (rep_exact if how == 'exact' else rep_norm).append((sp['title'], nid, sp['group']))
        else:
            nid = slug(sp['display_title'] or sp['title'], taken)
            p = {'id': nid, 'title': sp['title']}
            if sp.get('display_title') and sp['display_title'] != sp['title']: p['display_title'] = sp['display_title']
            p.update({'group': None, 'desc': '', 'type': None, 'role': 'room', 'comes': [], 'sources': [], 'approved': False,
                      'state': 'planned', 'visibility': 'private', 'held': False, 'never_public': False, 'special': None,
                      'created': now, 'updated': now})
            rep_created.append((sp['title'], nid, sp['group']))
        if sp.get('display_title') and sp['display_title'] != p['title'] and not p.get('display_title'): p['display_title'] = sp['display_title']
        p['group'] = sp['group']
        p['desc'] = sp.get('desc') or ''
        if sp.get('not_started'): p['not_started'] = True
        if sp.get('not_started') and p.get('body'): rep_notes.append('"%s" is marked not_started in the seed but already has a body (%d paragraphs).' % (sp['title'], len(p['body'])))
        if sp.get('special') == 'private_never_public': p['never_public'] = True; p['special'] = 'private_never_public'
        if sp.get('special') == 'directory_intro': p['special'] = 'directory_intro'
        placed[nid] = True; pieces[nid] = p

    held_titles = [h['title'] for h in S.get('held_never_public', [])]
    rep_held = []
    for h in S.get('held_never_public', []):
        nid = by_exact.get(h['title']) or by_norm.get(norm(h['title']))
        if nid and nid in pieces:
            p = pieces[nid]
        elif nid:
            p = convert(node[nid]); pieces[nid] = p; placed[nid] = True
        else:
            nid = slug(h['display_title'] or h['title'], taken)
            p = {'id': nid, 'title': h['title'], 'group': None, 'desc': '', 'type': None, 'role': 'room', 'comes': [], 'sources': [],
                 'approved': False, 'state': 'planned', 'visibility': 'private', 'held': False, 'never_public': False, 'special': None,
                 'created': now, 'updated': now}
            pieces[nid] = p
        p['group'] = 'held'; p['held'] = True; p['never_public'] = True; p['visibility'] = 'private'
        rep_held.append((h['title'], nid))

    unsorted = []
    for n in G['nodes']:
        if n['id'] in pieces: continue
        p = convert(n); p['group'] = 'unsorted'; pieces[n['id']] = p; unsorted.append((n['title'], n['id']))
    if unsorted: groups.append({'id': 'unsorted', 'name': 'Unsorted', 'order': 98})
    if rep_held: groups.append({'id': 'held', 'name': 'Held (never public)', 'order': 99})

    # keep the old order of pieces where they existed, new ones after
    order = [n['id'] for n in G['nodes']] + [k for k in pieces if k not in node]
    plist = [pieces[k] for k in order if k in pieces]

    links = []
    for i, r in enumerate(X['relations']):
        links.append({'id': 'lk-%03d' % (i + 1), 'source': r['source'], 'from_q': r.get('from_q') or '', 'target': r['target'],
                      'to_q': r.get('to_q'), 'type': r['type'], 'author': 'proposed', 'reason': r.get('reason') or '', 'text': '',
                      'created': None, 'updated': None})
    types = [{'id': t['id'], 'label': t['label'], 'meaning': t.get('meaning') or '', 'color': t.get('color')} for t in X['types']]
    threads = [{'id': t['id'], 'name': t['name'], 'about': t.get('about') or '', 'path': list(t['path'])} for t in X['threads']]
    terms, tt = [], set()
    for l in G.get('lexicon') or []:
        terms.append({'id': slug(l['term'], tt), 'term': l['term'], 'definition': l.get('definition'),
                      'appears_in': [a for a in l.get('appears_in') or [] if a in pieces], 'visibility': 'private', 'updated': None})

    content = {
        'blawg': '0.2',
        'cut': 'private',
        'about': 'Full private content of the blawg. Lives in content-private/ (gitignored). Never commit this file.',
        'migrated': now,
        'site': {'title': 'Blawg', 'intro': []},
        'piece_types': TYPES,
        'roles': G.get('roles') or {},
        'audiences': ['Builders', 'Students', 'Friends', 'Philosophy', 'Politics', 'Taste', 'Everyone'],
        'held_titles': held_titles,
        'groups': groups,
        'pieces': plist,
        'links': links,
        'types': types,
        'threads': threads,
        'terms': terms,
        'loose_lines': loose,
    }
    (out / 'content.json').write_text(json.dumps(content, ensure_ascii=False, indent=1), encoding='utf-8')

    L = ['# Migration report', '', 'Run %s. Seed: %d pieces in %d groups, %d held titles. Old map: %d pieces, %d links, %d threads, %d lexicon terms.' % (
        now, len(S['pieces']), len(S['groups']), len(held_titles), len(G['nodes']), len(X['relations']), len(X['threads']), len(G.get('lexicon') or [])), '',
        'Result: %d pieces, %d groups, %d links, %d threads, %d terms, %d loose lines kept from the old holes. Every piece is private.' % (
        len(plist), len(groups), len(links), len(threads), len(terms), len(loose)), '']
    L += ['## Matched exactly (%d)' % len(rep_exact), ''] + ['- %s → `%s` (%s)' % x for x in rep_exact] + ['']
    L += ['## Matched after normalising (%d)' % len(rep_norm), ''] + (['- %s → `%s` (%s)' % x for x in rep_norm] or ['None.']) + ['']
    L += ['## Created as planned pieces (%d): in the seed, not on the map' % len(rep_created), ''] + ['- %s → `%s` (%s)' % x for x in rep_created] + ['']
    L += ['## Unsorted (%d): on the map, not in the seed' % len(unsorted), ''] + ['- %s (`%s`)' % x for x in unsorted] + ['']
    L += ['## Held, never public (%d)' % len(rep_held), ''] + ['- %s → `%s`' % x for x in rep_held] + ['']
    L += ['## Notes', ''] + (['- ' + x for x in rep_notes] or ['None.']) + ['']
    (out / 'migration-report.md').write_text('\n'.join(L), encoding='utf-8')
    print('\n'.join(L[:4]))
    print('exact %d, normalised %d, created %d, unsorted %d, held %d' % (len(rep_exact), len(rep_norm), len(rep_created), len(unsorted), len(rep_held)))


if __name__ == '__main__':
    if len(sys.argv) != 5: sys.exit(__doc__)
    main(*sys.argv[1:])

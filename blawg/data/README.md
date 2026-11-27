# Blawg data contract (shared by the reader app B1 and the editor B2/B3)

All paths are inside the repo. Everything public is plain JSON/Markdown under `blawg/`.

## blawg/data/groups.json
`[{"id":"make","name":"What I make and how","order":1,"accent":"orange"|"teal","art":null|"<artId>"}]`
12 groups. accent alternates orange/teal by order.

## blawg/data/pieces.json  (LIVE pieces only, plus seed titles that are public)
`[{"id":"make-philosophy-of-building-apps","title":"...","desc":"...","group":"make","type":"Principle"|"Question"|"Stance"|"Case study"|"Reaction"|"Log"|"Note"|"Door"|null,"state":"live"|"seed","art":["<artId>",...],"img":null|"blawg/img/<file>.jpg","locked":false,"body":false|true}]`
- `body:true` means `blawg/pieces/<id>.md` exists and is public.
- `state:"seed"` = title + desc only, no body yet (the wipe-to-seed state).
- Locked essays: `"locked":true` and `"cipher":"<base64>"` instead of a .md file.
- ids: lowercase slug `[a-z0-9-]+`, stable, never reused.

## blawg/pieces/<id>.md
Plain Markdown body only (no front matter). Only approved/live bodies are ever written here.

## blawg/data/connections.json  (his real connections ONLY)
`[{"id":"lk-001","ends":["<pieceId>","<pieceId>",...],"text":"his words or empty string","label":"" ,"state":"live"}]`
2+ ends. Today exactly one real connection exists: Libxndr ⇄ Information Age and Knowledgemaxing.

## blawg/data/art.json
`{"library":[{"id":"fallen-tree","name":"Fallen tree","kind":"ascii"|"img","src":"assets/ascii/fallen-tree.js"|"blawg/art/<file>.png"}],
  "assign":{"piece":{"<pieceId>":["<artId>"]},"type":{"Case study":"<artId>"},"group":{"<groupId>":"<artId>"}},
  "gallery":["<artId>",...]}`
TV order: piece art > type default > group art > gallery.

## blawg/img/ and blawg/art/
JPG or PNG only, plain lowercase filenames `[a-z0-9-]+\.(jpg|png)`, resized to <=1600px wide and <=400KB before commit. No WebP.

## blawg/data/drafts.enc
Every draft piece, draft body and draft connection, as ONE encrypted blob:
`{"v":1,"kdf":"PBKDF2-SHA256","iter":310000,"salt":"<b64>","iv":"<b64>","ct":"<b64 AES-GCM>"}`
Plaintext inside = `{"pieces":[...same shape + "bodyText"],"connections":[...]}`. Titles included (titles of drafts are private).

## Changeset (import format; same for the editor's Import, a Claude chat, and Warb PRs)
```json
{"changeset":1,"author":"waleed|claude|warb","note":"optional","ops":[
  {"op":"create","kind":"piece","id":"new-id","set":{"title":"...","desc":"...","group":"make","type":"Note","state":"draft","body":"markdown..."}},
  {"op":"update","kind":"piece","id":"existing-id","set":{"desc":"..."}},
  {"op":"delete","kind":"piece","id":"existing-id"},
  {"op":"create","kind":"connection","id":"lk-002","set":{"ends":["a","b"],"text":"...","label":"","state":"draft"}},
  {"op":"update","kind":"connection","id":"lk-002","set":{"state":"live"}},
  {"op":"delete","kind":"connection","id":"lk-002"},
  {"op":"assign","kind":"art","target":"piece|type|group|gallery","key":"<pieceId|type|groupId>","art":["<artId>"]}
]}
```
A `.md` file with a front-matter header (`title, group, type, state`, optional `id`, `desc`) is one piece create/update.
Validation: unknown ids, connection to a deleted/unknown piece, duplicate titles, bad group/type/state, bad filenames → flagged with a reason; nothing applies until the diff is accepted.
Deleting a piece also deletes connections that would drop below 2 ends (listed in the diff).

## Privacy (hard rule — repo is public)
- Held titles and private pieces never enter the repo in any form (data, comments, tests, commit messages, hashes).
- Draft state and unapproved bodies only ever go into drafts.enc.
- `tools/blawg/check_public.py` fails the commit/CI if: a held title (read from the gitignored `content-private/` dir when present) appears anywhere under blawg/, a non-live piece's body is a plain .md, a piece with state draft is in pieces.json, a connection with state draft is in connections.json, a filename is not plain, a .webp exists.

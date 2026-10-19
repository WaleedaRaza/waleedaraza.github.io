"""
Turn the screenshot folders into web-ready gallery images for the product pages.

    python tools/build_media.py

Reads the source folders (left untouched), crops browser chrome where listed,
writes JPEG images to pics/products/<product>/ and the gallery list to
projects/media.js. Add a screenshot to a source folder, give it a caption
below (optional), and run this again.
"""
import hashlib
import json
import os
import re
import shutil

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# product -> source folders, in gallery order. Files named PREVIEW* are the starter image;
# when a product has several previews, the page picks one of them at random.
PRODUCTS = {
    'warb': ['Warbspace.com', 'My examples for warb'],
    'libxndr': ['LIBXNDR.com'],
    'pokeraio': ['PokerAIO.com'],
}

# (left, top, right, bottom) pixels to trim: browser tabs, bookmarks bar, taskbar, scrollbar
CROPS = {
    'LIBXNDR.com/PREVIEW.png': (0, 124, 12, 43),
    'Warbspace.com/Screenshot 2026-10-12 022225.png': (0, 64, 0, 7),
    'My examples for warb/PREVIEW 1.png': (0, 228, 0, 0),
    'My examples for warb/Screenshot 2026-10-16 141840.png': (0, 228, 0, 0),
    'My examples for warb/Screenshot 2026-10-16 141853.png': (0, 228, 0, 0),
    'My examples for warb/Screenshot 2026-10-16 141911.png': (0, 228, 0, 83),
}

# Captions describe only what the screenshot shows
CAPTIONS = {
    'Warbspace.com/PREVIEW 2.png': 'warbspace.com: a notebook for your whole life',
    'Warbspace.com/Screenshot 2026-10-16 141242.png': 'Log anything. Warb works out the planet and the type, and files it.',
    'Warbspace.com/Screenshot 2026-10-16 141256.png': 'Talk to your vault: answers that show which notes they read',
    'Warbspace.com/Screenshot 2026-10-16 141330.png': 'Keep a living log, and lay out a plan',
    'Warbspace.com/Screenshot 2026-10-16 141338.png': 'Go after one thing, and why agents need what you know',
    'Warbspace.com/Screenshot 2026-10-12 022225.png': 'My workspace: a note being filed to its planet',
    'Warbspace.com/Screenshot 2026-10-16 141743.png': 'Opening the vault',
    'My examples for warb/PREVIEW 1.png': 'My vault: every planet and its notes',
    'My examples for warb/Screenshot 2026-10-16 141840.png': 'Working on the stage, with notes pulled up around a draft',
    'My examples for warb/Screenshot 2026-10-16 141911.png': 'The journal and conversations beside the vault',
    'LIBXNDR.com/PREVIEW.png': 'Libxndr',
    'LIBXNDR.com/Screenshot 2026-10-16 141657.png': 'The vault: the shared collection, browsable A to Z',
    'LIBXNDR.com/Screenshot 2026-10-16 141726.png': 'The source finder: find one book or dozens',
    'PokerAIO.com/PREVIEW.png': 'Poker All In One: the table',
    'PokerAIO.com/Screenshot 2026-10-16 141424.png': 'Play now, and learn how to play',
    'PokerAIO.com/Screenshot 2026-10-16 141436.png': 'Friends, clubs and analytics',
    'PokerAIO.com/Screenshot 2026-10-16 141448.png': 'Poker today: poll, news and play',
    'PokerAIO.com/Screenshot 2026-10-16 141453.png': "Learn poker: a free Texas Hold'em curriculum",
    'PokerAIO.com/Screenshot 2026-10-16 141501.png': 'Friends, clubs and groups',
}

# Link-preview image (1200x630) per product: the source file to crop from the top of
OG_SOURCE = {
    'warb': 'Warbspace.com/PREVIEW 2.png',
    'libxndr': 'LIBXNDR.com/Screenshot 2026-10-16 141657.png',
    'pokeraio': 'PokerAIO.com/PREVIEW.png',
}

MAX_LANDSCAPE_W = 1800
MAX_PORTRAIT_W = 1100
EXTS = ('.png', '.jpg', '.jpeg', '.webp')


def slug(name):
    return re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')


def build():
    media = {}
    for product, folders in PRODUCTS.items():
        out_dir = os.path.join(ROOT, 'pics', 'products', product)
        shutil.rmtree(out_dir, ignore_errors=True)
        os.makedirs(out_dir)
        seen, previews, images = set(), [], []
        files = []
        for folder in folders:
            names = sorted(n for n in os.listdir(os.path.join(ROOT, folder)) if n.lower().endswith(EXTS))
            # previews first within each folder so they win the duplicate check
            names.sort(key=lambda n: (not n.upper().startswith('PREVIEW'), n))
            files += [f'{folder}/{n}' for n in names]
        for rel in files:
            digest = hashlib.md5(open(os.path.join(ROOT, rel), 'rb').read()).hexdigest()
            if digest in seen:
                continue  # a PREVIEW is a labelled copy of one screenshot
            seen.add(digest)
            im = Image.open(os.path.join(ROOT, rel)).convert('RGB')
            l, t, r, b = CROPS.get(rel, (0, 0, 0, 0))
            im = im.crop((l, t, im.width - r, im.height - b))
            max_w = MAX_LANDSCAPE_W if im.width >= im.height else MAX_PORTRAIT_W
            if im.width > max_w:
                im = im.resize((max_w, round(im.height * max_w / im.width)), Image.LANCZOS)
            name = f'{len(images) + 1:02d}-{slug(os.path.splitext(os.path.basename(rel))[0])}.jpg'
            im.save(os.path.join(out_dir, name), 'JPEG', quality=84, optimize=True, progressive=True)
            src = f'pics/products/{product}/{name}'
            images.append({'src': src, 'w': im.width, 'h': im.height, 'caption': CAPTIONS.get(rel, '')})
            if os.path.basename(rel).upper().startswith('PREVIEW'):
                previews.append(len(images) - 1)
            print(f'{product:9s} {src:60s} {im.width}x{im.height}')
        media[product] = {'previews': previews, 'images': images}
        # a fixed name the home page can use if the gallery script ever fails to load
        shutil.copyfile(os.path.join(ROOT, images[previews[0] if previews else 0]['src']), os.path.join(out_dir, 'cover.jpg'))

        og = Image.open(os.path.join(ROOT, OG_SOURCE[product])).convert('RGB')
        l, t, r, b = CROPS.get(OG_SOURCE[product], (0, 0, 0, 0))
        og = og.crop((l, t, og.width - r, og.height - b))
        og = og.resize((1200, round(og.height * 1200 / og.width)), Image.LANCZOS)
        if og.height < 630:
            og = og.resize((round(og.width * 630 / og.height), 630), Image.LANCZOS)
        left = (og.width - 1200) // 2
        og.crop((left, 0, left + 1200, 630)).save(os.path.join(out_dir, 'og.jpg'), 'JPEG', quality=84, optimize=True, progressive=True)

    js = ('// Generated by tools/build_media.py - edit that script, not this file.\n'
          f'window.PRODUCT_MEDIA = {json.dumps(media, indent=2, ensure_ascii=False)};\n')
    with open(os.path.join(ROOT, 'projects', 'media.js'), 'w', encoding='utf-8') as fh:
        fh.write(js)

    # X header from the uploaded original
    header = os.path.join(ROOT, 'Twitter header.png')
    if os.path.exists(header):
        im = Image.open(header).convert('RGB').resize((1500, 500), Image.LANCZOS)
        im.save(os.path.join(ROOT, 'pics', 'x-header.jpg'), 'JPEG', quality=86, optimize=True, progressive=True)
        print('pics/x-header.jpg 1500x500')


if __name__ == '__main__':
    os.makedirs(os.path.join(ROOT, 'projects'), exist_ok=True)
    build()

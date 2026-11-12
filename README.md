do you have your own corner in the internet? well i do! and this is the repository which holds it

## Development

```bash
npm install
npm run dev
npm run build
```

## Gallery image optimizer

The gallery source photos in `src/assets/gallery` are large PNGs. Before
committing new photos, you can resize and re-encode them with the Python helper:

```bash
python -m pip install -r requirements.txt
python scripts/optimize_gallery.py --dry-run
python scripts/optimize_gallery.py
```

By default the script keeps the original format and resizes images so their
longest side is at most 1600px. It only replaces a file when the optimized
version is smaller, so it is safe to re-run. Use `--format webp` for smaller files:

```bash
python scripts/optimize_gallery.py --format webp --quality 82
```

Converting to WebP changes file extensions, so update any explicit `cover:`
fields in `src/content/gallery/*.md` if you use them. GIFs and animated images
are skipped so they keep animating.

Run `python scripts/optimize_gallery.py --help` for all options.

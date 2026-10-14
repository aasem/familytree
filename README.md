# Family tree

A static family register. It is the website and the installable app: one set of files, no database, no build step. People live in [`data/family.json`](data/family.json). Small face photos live in [`photos/`](photos/).

The page opens on a clickable tree around one person: grandparents, parents, siblings, spouse, and children. **Lineage** is the whole branch, dragged and zoomed, which is the view that stays readable past a few hundred people. **Directory** is the A–Z list. Search is the fastest way in (`/`).

The 27 people already in the file are a sample. Replace them.

## Add a person

```json
{
  "id": "yusuf",
  "name": "Yusuf Khan",
  "living": true,
  "birth": "1950",
  "death": "",
  "place": "Lahore",
  "photo": "photos/yusuf.jpg",
  "bio": "One or two sentences.",
  "gender": "male",
  "father": "ibrahim",
  "mother": "amina",
  "spouses": ["zainab"]
}
```

`id` stays stable, because everyone else points at it. `living` is true or false. Dates can be a year or any short text (`1954`, `1954-03`, `c. 1890`). `gender` is optional and is only used to say son or daughter. Children do not need their own list: set `father` and `mother` on the child.

`focusId` is who the tree opens on. Set `"dir": "rtl"` if the register should read right to left. Names can be Urdu or English either way.

## Add a pet

```json
{
  "id": "mishi",
  "name": "Mishi",
  "kind": "pet",
  "species": "cat",
  "living": true,
  "birth": "2021",
  "photo": "photos/mishi.jpg",
  "bio": "Rules the sofa.",
  "owners": ["asim", "sheeza"]
}
```

`species` may be `cat`, `dog`, `bird`, or `other`. Without a photo, cat and dog get a small animal avatar. Pets show under their owners on the tree and in the sidebar; they are not part of the bloodline.

When the sample is gone, remove `"sample": true`. Cursor will check the file against [`data/family.schema.json`](data/family.schema.json) as you type. A problem in the JSON is also listed at the top of the page.

## Photos

Crop to the face. Export JPEG or WebP at about 256×256, quality around 70. Most files land between 8KB and 30KB, so five hundred portraits stay well under a typical GitHub limit.

```json
"photo": "photos/yusuf.jpg"
```

The path is relative. Do not start it with `/`. If a file is missing, the card shows the person's initials.

## Run it locally

Opening `index.html` as a file will not load the JSON. From this folder:

```bash
python -m http.server 8765
```

Then open `http://127.0.0.1:8765/`.

## GitHub Pages

This repository is a project site, separate from the Jekyll profile at `https://aasem.github.io/`.

1. Push `main`.
2. On GitHub: Settings → Pages → Build and deployment → Deploy from a branch.
3. Branch `main`, folder `/ (root)`, then Save.

The register is then at `https://aasem.github.io/familytree/`. Relatives can install it from the browser (Add to Home Screen on iPhone).

[`.nojekyll`](.nojekyll) is in this repo on purpose. GitHub Pages runs Jekyll on every site unless that file is present. This app is plain HTML, CSS, and JavaScript, and it should be copied to the server as-is. It does not belong in the profile repository. That site should keep using Jekyll.

The page sends `noindex`, so search engines are asked not to list it. If the GitHub repository is public, anyone with the link can still read the JSON and the photos. Use a private repository if the register should stay in the family.

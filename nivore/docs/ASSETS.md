# Visual assets

## What exists today
- **Brand Book (23 pages):** colours, typography, logo rules and art direction.
  - The wordmark is a *working reconstruction* in Inter SemiBold / Regular, built to the book's proportions (`components/brand/Brand.tsx`). The book notes that no vector master exists yet; replace it with outlined vector artwork once redrawn.
  - Monogram N1 and the minute-track rule are drawn from the book's specifications.
- **No product photography or 3D models were supplied.** Every watch on the site is an *illustrative rendering* drawn from component measurements, and is labelled as such.
- Editorial photo slots use the book's hatched placeholder style with a caption of the intended shot ("PHOTO — dial macro…"). Replace them in Admin → Content.

## Folder conventions (production storage buckets)
```
catalogue/products/<product-id>/<n>.jpg     editorial and product photographs (4:5, ≥2000 px long edge)
preview-layers/<component-id>/<slot>-<view>.webp   transparent configurator layers
editorial/<page>/<name>.jpg                  homepage, atelier, packaging imagery
```
In development, uploads go to `public/uploads/dev/` with random names.

## Photographing configurator layers
1. **Camera:** fixed, straight-on, long lens (≥ 100 mm equivalent) to avoid perspective distortion. Even, diffused light from one direction, as the book specifies.
2. **One part per frame,** on a background you can remove cleanly, or render from CAD if supplier models exist.
3. Include a **millimetre scale** in a calibration frame at the same distance, to compute pixels per mm.
4. Export **WebP with alpha** at about 1500–2000 px on the long edge. Keep shadows on their own layer or omit them; the renderer adds a soft ground shadow.

| Slot | Anchor point | Notes |
| --- | --- | --- |
| case | dial centre | Case, lugs and crown, without bezel, dial or strap |
| bezel / insert / chapterRing / crystal | centre | Crystal: reflection only, mostly transparent |
| dial | pinion hole | Include the date window cut-out; the date wheel shows through |
| hand-hour / hand-minute / hand-seconds / hand-gmt | pinion hole | Hand pointing to 12; the renderer rotates it |
| band-top / band-bottom | centre of the spring bar | Top half from the case outward, bottom half likewise |
| caseback | centre | Rear view |

## Adding a layer
Go to Admin → Preview assets:
1. Upload the image and choose the component and slot.
2. Click the anchor on the image.
3. Enter the pixels per mm, or the physical width across the image.
4. Check the overlay in the preview, then publish.

Draft and validated layers never reach customers. As soon as every visible part of a build has a published layer, the "Illustrative rendering" label disappears for that build.

## Licensing
Use only original photography, or photography and renders you hold rights to. Never use another watch company's imagery or logos. Supplier photos usually need written permission.

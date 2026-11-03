# HomeCraft 3D — luxury architectural design studio (mobile-first)

Build homes from ground floor upward on any device. Monochrome professional UI (black/charcoal/silver, Inter, Lucide line icons, no emoji in the interface).

## Features
- **Projects**: multiple houses (new / duplicate / rename / delete / switch), per-project autosave, export/import JSON.
- **Infinite floors**: add / duplicate / rename / delete; each floor has own walls, doors, windows, furniture, slab.
- **Locking**: per-wall / per-item lock, lock/unlock-all menu actions, lock badges in 2D and labels.
- **2D plan mode**: grid + snap, wall polyline drawing, Room tool, drag walls/endpoints (openings follow), compact contextual toolbar (Properties opens the full panel, pin keeps it), Measure, slab editor, ceiling toggle, stairs, undo/redo, delete. Catalog collapses for full workspace; fullscreen focus; portrait/landscape layout.
- **3D mode**: orbit / walk (joystick + WASD) / top / dollhouse / exterior. PBR: ACES, image-based lighting, soft shadows, day→night presets + brightness/warmth, procedural textures, baseboards/crown molding, framed openings, ceilings, roofs, floor finishes. Quality Low→Ultra. Tap-select with compact bar; **Use** button toggles interactive parts (doors, drawers, lights, screens, fans) with smooth animation + tone.
- **AI House Builder** (menu): plan image/PDF → vision AI detects walls/openings/rooms/scale → review → editable 2D shell (+3D). Also "describe a house" (text → validated house JSON → same review path).
- **Room AI Designer** (menu): AI suggests catalog items + wall palette for the room at screen center; place-without-removing, free-spot search, undo clean.
- **AI Furniture Creator** (menu): describe (+optional reference photos) → AI drafts a Vera-ready prompt → copy, generate in Vera's, import back.
- **Color & Material Studio** (select an item → Properties → Customize): per-object or per-part colors (with Recent Swatches memory), finishes, textures, palettes, undo/redo — survives rebuilds and saves.
- **Design Assistant** (top bar): collapsible chat panel with shortcuts into the AI tools + free Q&A grounded in the current house.
- **Catalog drawers (2D + 3D)**: left **Build** drawer (19 mode tools + Structure, Flooring, Pools, Patios, Landscaping, Outdoor, Textures tiles) and right **Furnish** drawer (Sofas & sectionals, Sitting chairs, Bedroom, Kitchen, Dining, Pantry, Bath, Wall Decor, Shelving, Decor, Plants, Lighting, Glam, Billiard, Bar + My Models). Two-column icon tiles → 2-column item/texture card grids, full-text search each side (build search also matches textures; furnish search sorts by category → sub-group → name), Wall/Shelf filters on furnish, All/Outdoor/Textures shortcuts on build, category descriptions, dims on every card. Sofas & sectionals groups: Couches, Sofas, Loveseats, Recliners (+More). Sitting chairs groups: Barstools & stools, Dining chairs, Sitting chairs, Vanity chairs, Rocking chairs. Textures arm the matching Surface/Patio/Terrain tool on tap. Realistic **3D-rendered thumbnails** (generated on-device per def, cached in memory; uploads keep their import thumbnails). Drawers slide away on canvas tap or X; single scrollable top bar (2D/3D, floor, menu, tools, banner at end).
- **Building**: wall finishes (paint/wallpaper/brick/stone/panels…, room/floor/house scopes, two-tone splits), per-room flooring, patios, terrain brush, pools (shapes, water, lights, fountain, cover, steps, diving board), wall-mount + shelf children, room designs, copy/paste style.
- **Uploads**: .glb/.gltf/.obj/.fbx/.stl/.3ds/.zip with texture relink, thumbnails, optimized GLB export, AI identify, never-duplicate names.
- **Google Drive backup** (menu): own OAuth client ID (one-time paste, stored
  locally) → Connect → Save backup now / backup list with Load (same
  validation as Import JSON, undoable). `drive.file` scope, resumable
  uploads. See Drive setup steps in the menu panel.
- **Dropbox backup** (menu, same pattern): own app key (one-time paste) →
  Connect (redirect back to the app) → Save backup now / list with Load
  (same validation, undoable). App-folder scope, single-call uploads.
  See Dropbox setup steps in the menu panel.
- **Persistence**: autosave (localStorage + kv), projects library, export/import JSON.

## Files
- `index.html` — UI shell (top bar, 2D/3D views, catalog drawers, assistant drawer, panels, modals). Loads `src/vendor/lucide.min.js` (vendored icons) then `src/app.js?v=…` (query bump forces fresh module fetch in the preview).
- `src/app.js` — orchestrator, tools, panels, floors/projects UI, uploads, AI wiring, assistant, icon system.
- `src/catalog.js` / `src/catalog_extra.js` — procedural furniture defs (data `icon` fields are legacy, no longer rendered).
- `src/thumbs.js` — offscreen 3D thumbnail renderer for catalog cards.
- `src/view2d.js` — canvas plan renderer (monochrome selection/indicators, initial-letter item glyphs).
- `src/view3d.js` — Three.js scene + interactive-parts animation loop.
- `src/mats.js` — procedural canvas textures + lighting/quality presets.
- `src/blueprint.js` — AI blueprint/describe wizard. `src/importer.js` — upload pipeline. `src/store.js` — state/projects/save.
- `src/drive.js` — optional Google Drive backup path.
- `src/dropbox.js` — optional Dropbox backup path (app-folder scope, redirect OAuth).
- `src/supabase/` — backend: `schema.sql` (run once in SQL editor), `client.js` (anon-key client + probe + timeouts), `auth.js`, `projects.js` (cloud save/load/backups/assets), `ui.js` (Settings status + menu auth/cloud), `README.md` (setup steps).
- `src/vendor/lucide.min.js` — vendored Lucide icons (ISC). `icon(name)` in app.js inlines SVGs; static HTML uses `data-lucide` + `createIcons()`.

## Data model
```
floor: { id, name, wallHeight, slab:{w,d,cx,cz,thick}, finish, ceil?, roof?, walls[], openings[], items[], zones[], pools[], paints[] }
wall: { id, x1,z1,x2,z2, h, t, color, finish?{tex,color}, split?{h,top,bottom}, locked? }
opening: { id, wallId, at, w, h, sill, kind:door|window|arch }
item: { id, defId|custom, x,z, rot, scale, color?, rise?(stairs), mount?{wallId,along,y,side}, on?{parentId,shelf,dx,dz}, ui?{tag:0|1}, locked? }
settings: { snap, wallThickness, wallHeightDefault, showAll3D, shadows, quality, lighting, brightness, warmth }
```

## Rebuild notes
- Three.js from esm.sh `three@0.160.0`. Needs network for 3D; 2D works offline.
- Floors stack: `floorBaseY(i)` = sum of wallHeight+slabThick below.
- Slabs are solid boxes (stairs decorative; no slab holes).
- Stairs auto-size: `it.rise` = `nextFloorRise(state, floorIdx)` on placement + floor add/remove + wall-height change (see `fitStairs`); slider + Auto-fit in the item panel; locked stairs are skipped.
- Flames (`flicker` ix kind: candle `burn`, chandelier `light`, fireplace `fire`) burn by default, taper/scale with flame noise in the 3D tick, and tap toggles them via the generic `toggleIx`.
- Custom meshes normalized (centered, capped) on import.
- Preview staleness: if the live preview ever runs older `src/` code after edits, bump the `?v=` query on the app script tag and re-refresh; verify with a live probe (e.g. handler source or `document.querySelectorAll('svg.lucide').length`).
- Never touch the user's house state except own clearly-marked test artifacts; clean up with undo + save.

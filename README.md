# SheetFormer — Object-Guided Form Study

SheetFormer is an interactive browser-based design study for incremental sheet forming. It projects a 3D OBJ reference onto a flat sheet, previews the resulting imprint, and lets the user explore raised contact-pad layouts before physical prototyping.

The current study uses a hand scan to investigate a wrist-and-palm impression, but the reference object and base plate can both be replaced with other OBJ files. This project is part of an experimental wearable-jewelry prototyping process.

## What it does

- Loads an OBJ reference and a base-plate OBJ, with the hand scan and a 304.8 × 304.8 mm plate provided as defaults.
- Lets you scale, rotate, and position the reference over the formable area while previewing the sheet in perspective and top views.
- Generates a high-resolution, single-valued surface imprint from the portion of the OBJ above the formable plate. An earlier manual fold mode remains available for comparison.
- Adds raised circular contact pads either at OBJ-picked points or in an aligned pattern. Pad diameter, height, and pattern position are adjustable.
- Displays live geometry statistics, a section graph, contour previews, and a maximum-face-slope warning.
- Exports an open-surface OBJ and a preview CSV of ordered contour points.

## Run locally

Requires Node.js. No package installation or build step is needed.

```sh
cd apps/sheetformer
npm run dev
```

Open [http://127.0.0.1:5173/apps/sheetformer/](http://127.0.0.1:5173/apps/sheetformer/).

The default study opens with the full hand reference, an 18.5 mm target depth, no OBJ-picked pads, the linear pad pattern switched on, and 2 mm pad extrusion. You can change these controls in the app or load your own OBJ files.

## Scope and safety

This is a **design preview, not a validated forming simulation or robot program**. The OBJ projection cannot represent undercuts, and the exported sheet is an open surface. The CSV is **not robot-ready**: it has not been checked for tool compensation, collisions, fixture clearance, material behavior, or the classroom robot's coordinate system. The slope control reports or warns about steep geometry; it does not automatically flatten it. OBJ units and anatomical contact points also require independent verification.

Review the geometry, material, tooling, and path with the instructor before fabrication. Do not use the preview alone to infer safe pressure on a person's hand or wrist.

For implementation details and the source-mesh workflow, see the [SheetFormer app README](apps/sheetformer/README.md).

# OBJECT GUIDED FORM STUDY

SheetFormer is an interactive browser-based design study for incremental sheet forming. It projects a 3D OBJ reference onto a flat sheet, previews the resulting imprint, and lets the user explore raised contact-pad layouts before physical prototyping.

The current study uses a hand scan to investigate a wrist-and-palm impression, but the reference object and base plate can both be replaced with other OBJ files. This project is part of an experimental wearable-jewelry prototyping process.

## What it does

- Loads an OBJ reference and a base-plate OBJ, with the hand scan and a 304.8 × 304.8 mm plate provided as defaults.
- Lets you scale, rotate, and position the reference over the formable area while previewing the sheet in perspective and top views.
- Generates a high-resolution, single-valued surface imprint from the portion of the OBJ above the formable plate. An earlier manual fold mode remains available for comparison.
- Adds raised circular contact pads either at OBJ-picked points or in an aligned pattern. Pad diameter, height, and pattern position are adjustable.
- Displays live geometry statistics, a section graph, contour previews, and local easing of faces above the maximum-face-slope setting.
- Exports an open-surface OBJ and a preview CSV of ordered contour points.

https://cristinanevelits.github.io/project2Code/apps/sheetformer/

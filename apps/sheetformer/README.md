# SheetFormer wrist study

Local first-pass prototype for Wednesday's 12 × 12 inch sheet-forming exercise. It follows the class sequence of selecting a formable face, refining the mesh, moving a target below the sheet, inspecting an angle limit, previewing descending contours, and exporting OBJ/CSV.

Run on this Mac:

```sh
cd "/Users/crisnevelits/Desktop/sci-arc/3GA/REHM/CODE/CLAUDE/projects/project2Code/apps/sheetformer"
npm run dev
```

Open `http://127.0.0.1:5173/apps/sheetformer/`. No packages need installing.

The project loads `references/3D/HAND_new_preview.obj`, a 54,960-vertex optimized preview generated from the user's 299 MB `PLASTIC FORM/hand_new.obj`. The source remains unchanged. To regenerate the preview, run `node apps/sheetformer/simplifyReference.mjs source.obj references/3D/HAND_new_preview.obj 0.04` from the repository root. The app also reads `references/3D/basePlate.obj` to set the 304.8 mm square sheet and 57.4 mm flat clamping inset. Drag the full hand in the top view; only its overlap with the formable face affects the sheet. The base OBJ is a flat reference: the exported formed sheet is still a separate design-preview mesh, not a modification of the source OBJ. The new hand OBJ has no declared unit, so the display scale is **only a starting guess**. Confirm scale and which side of the scan is the dorsal surface before drawing fabrication conclusions.

The OBJ-driven mode projects a high-resolution single-valued height field from the reference mesh; it cannot reproduce undercuts or prove that plastic can be formed to the previewed surface. The manual mode retains the earlier fold options. Neither mode implements the professor's self-organizing points, stiffness search, a true continuous spiral, or collision validation. The exported surface is open, and the CSV is **not robot-ready**. Review the formed shape, material, fixture, tool, coordinate frame, and path with the instructor before running the robot.

In OBJ-driven mode, selected blue reference points that lie wholly inside the formable face create circular depressions deeper than the surrounding hand/wrist imprint. The contact-circle diameter and depression-depth sliders alter the actual sheet mesh and exported OBJ; depth zero returns to the plain imprint. Pads are not created outside the clamp boundary, and the source OBJ is unchanged. The selected locations are geometric samples of the OBJ, **not anatomically validated pressure points**. Contact pressure, material thickness, forming limits, and wearer comfort still require physical testing. The preview CSV remains unsuitable for robot execution.

The OBJ-picked pressure-point count can be set to zero for an imprint without pads. Turning the Linear pad pattern switch ON replaces those points with aligned rows of deeper circular depressions spaced at 1.6 times their diameter; only complete circles inside the imprint and clamp border are kept. The pattern follows the translated and rotated OBJ. In linear mode the point-count slider does not control the number of pads.

Pattern seed (0–100) shifts the aligned grid continuously across the imprint. Seed 50 retains its original position; changing the seed does not move the OBJ or affect OBJ-picked pad mode.

The blue width caliper in the top view starts at the narrowest wrist–palm slice of the default scan (searched from 29–46% along its forearm-to-fingers Y axis). Drag the line vertically to measure a different slice; the width readout updates in Live Stats. It measures the projected left-to-right OBJ outline at the current display scale, not wrist circumference. Uploaded OBJs must use the same forearm-to-fingers Y orientation for the automatic wrist location to be meaningful. Confirm OBJ units and critical dimensions against a physical measurement before fabrication.

The default startup preset positions the full hand at sheet position (160.7, 217.2) mm at 29.1 mm/unit, rotated 180° around the wrist–finger axis. It uses 2 mm mesh spacing, an 18.5 mm **target** depth, zero OBJ-picked pressure points, the linear pad pattern ON with seed 50, and 11 mm diameter × 2 mm nominal pad depressions. Faces over the 50° maximum are eased locally instead of scaling the whole surface down. The preview reports the resulting maximum face angle and actual formed depth. Loading a different OBJ auto-fits that reference; changing the base plate preserves the current reference scale and position where possible.

The toolpath preview links successive contour loops with descending feed moves. Each link is split wherever its XY line crosses a mesh grid line or triangle diagonal, then given the exact surface height there. This prevents a straight link from cutting through the piecewise-planar preview mesh; it retracts and jogs when a separate island or intervening ridge prevents a descending surface link. The first approach and final retract remain, and Live Stats excludes them from the island-transition count. Contact with the sheet is intentional. This is **not** a safe robot route: the CSV is a surface-contact path, not a ball-end tool-center path; no tool-radius compensation, tool-body/fixture collision checking, material/forming-force model, or robot kinematic validation is performed.

The instructor's uploaded `SheetFormer.html` and `SheetFormer.md` (in Downloads) are the reference implementation. This preview matches their CSV header and `move` labels (`jog`, `plunge`, `feed`), with Z0 at the top of the sheet and negative Z into it. It does **not** reproduce the sample's ball-tool compensation, collision checks, or table-leg stiffness/stability optimisation.

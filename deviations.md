# Deviations

This file lists the rules of tiavelum/engineering-standards that this
repository deviates from, with the reason for each, for its maintainers and
for anyone who applies the standards to it.

## NAM-2: page files below `sheets/*/project/`

The page files of a sheet, such as `Main.dc.html`, `Details.dc.html` and
`Page-2.dc.html`, keep the names the Design canvas gives them, with capital
letters, although no tool fixes the names other than `Main.dc.html`. Each file
name is the key of its page in the canvas's `canvas.json` and the path the
canvas serves it under, so a renamed file no longer matches its canvas, and a
session could no longer publish the archived files back to the canvas as they
are. [The contract of a sheet folder](sheets/README.md#page-files) states
which files these are.
Recorded 2026-11-03.

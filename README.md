# Three.js Dental Annotation Plugin

Copyright (c) CytoArchiLab. All rights reserved.

A browser-based 3D dental mesh annotation editor built on Three.js. Import dental models (PLY/STL/OBJ), label vertices by FDI tooth number using brush/eraser/flood-fill tools, and export colored PLY + JSON metadata.

No build tools, no framework — pure vanilla HTML/CSS/JS with Three.js r170 via CDN.

## Quick Start

```bash
cd editor
python3 -m http.server 8080
# or
npx serve .
```

Open http://localhost:8080/, drag-drop a dental mesh file, and start annotating.

## Features

- **FDI Tooth Labeling** — 32 teeth + gingiva/anatomy/pathology labels with auto-generated distinct colors
- **Brush Tool** — Radius-based vertex painting with drag interpolation
- **Eraser Tool** — Remove labels from vertices
- **Flood Fill Tool** — BFS adjacency-based region filling
- **Undo/Redo** — Full command-pattern history (Cmd/Ctrl+Z / Cmd/Ctrl+Shift+Z)
- **Export** — Binary PLY with vertex colors + JSON sidecar with label statistics
- **Camera Presets** — 7 dental view angles (front/back/left/right/top/bottom/occlusal)
- **Lighting Controls** — Camera headlight, ambient intensity, toggle

## Controls

| Input | Action |
|-------|--------|
| Left-click drag | Paint / erase / fill |
| Right-click drag | Rotate view |
| Middle-click drag | Pan |
| Scroll wheel | Adjust brush radius |
| Cmd/Ctrl + scroll | Zoom |
| B / E / F | Switch Brush / Eraser / Fill tool |
| \[ / \] | Decrease / increase brush radius |
| Numpad 1-7 | Camera presets |

## Architecture

```
editor/
├── index.html              ← Entry point
├── css/main.css            ← Dark theme
├── js/
│   ├── Editor.js           ← Three.js scene, camera, controls, file loaders
│   └── dental/
│       ├── DentalPlugin.js       ← Plugin entry point
│       ├── LabelSchema.js        ← FDI label definitions + colors
│       ├── VertexLabelManager.js  ← Per-vertex label storage + color sync
│       ├── SpatialIndex.js        ← Grid-based spatial index
│       ├── LabelCommands.js       ← Undo/redo commands
│       ├── BrushTool.js           ← Radius painting + drag interpolation
│       ├── EraserTool.js          ← Erase labels
│       ├── FloodFillTool.js       ← BFS flood fill
│       ├── SidebarDental.js       ← UI panel
│       └── DentalExporter.js      ← PLY + JSON export
```

## Dependencies

- [Three.js r170](https://threejs.org/) (loaded via CDN, MIT License)

No other external dependencies.

## License

Copyright (c) CytoArchiLab. All rights reserved.

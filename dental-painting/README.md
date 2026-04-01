# Three.js Dental Annotation Plugin

A browser-based 3D dental mesh annotation editor built on Three.js. Import dental models (PLY/STL/OBJ), label vertices by FDI tooth number using brush/eraser/flood-fill tools, and export colored PLY + JSON metadata.

Built with vanilla HTML/CSS/JS and Three.js r170 via CDN.

## Download

```bash
git clone --depth 1 --filter=blob:none --sparse https://github.com/CytoArchilab/Plugins.git
cd Plugins
git sparse-checkout set dental-painting
```

## Quick Start

> **Important**: Do NOT open `index.html` by double-clicking — the browser will block ES Module imports under the `file://` protocol. You must run a local HTTP server.

### Step 1: Open Terminal

- **Mac** — Press `Cmd + Space`, type `Terminal`, press Enter
- **Windows** — Press `Win + R`, type `cmd`, press Enter (requires [Git](https://git-scm.com/) and [Python](https://www.python.org/) installed)
- **Linux** — Press `Ctrl + Alt + T`

### Step 2: Navigate to the plugin folder and start the server

**Option A — Python (pre-installed on Mac/Linux)**:

```bash
cd dental-painting
python3 -m http.server 8080
```

**Option B — Node.js**:

```bash
cd dental-painting
npx serve .
```

Then open http://localhost:8080/ in your browser, drag-drop a dental mesh file (PLY/STL/OBJ), and start annotating.

> **If you see `OSError: Address already in use`**, port 8080 is occupied. Use a different port:
> ```bash
> python3 -m http.server 8888
> ```
> Then open http://localhost:8888/ instead.

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

## Contact

[CytoArchiLab](https://cytoarchilab.org) — For questions or issues, please contact yuhuili@hku.hk

## License

Copyright (c) CytoArchiLab. All rights reserved.

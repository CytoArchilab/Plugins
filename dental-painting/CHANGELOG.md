# Changelog

## v2.0 (2025-04-05)

### New Features

- **Text Annotation Tool** — Click on the 3D model surface to place anchor text annotations
  - 8 marker icons (pin, flag, circle, diamond, star, cross, arrow, tag) rendered as SVG
  - 8 preset annotation colors with color picker in sidebar
  - Distance-based auto-scaling (0.4–1.2 range)
  - Single-click to select, double-click to edit text
  - Full undo/redo support (add, remove, edit)
- **Color Mode Toggle** — Switch between original mesh vertex colors and label-overlay colors
- **Screenshot Export** — PNG capture of the viewport including annotation overlays
- **Annotation List Panel** — Sidebar panel to manage all annotations (select, show/hide, delete, bulk operations)

### Enhancements

- Sidebar expanded with Text Settings, Annotations, and Color Mode sections
- Keyboard shortcut `T` to switch to Text tool
- JSON export now includes annotation data (position, normal, text, color, marker)
- VertexLabelManager preserves original PLY vertex colors for color mode switching
- DentalExporter accepts annotation manager for unified export

### Project

- Added MIT LICENSE
- Added .gitignore
- Updated README with complete feature list, architecture, and dependencies

---

## v1.0 (2025-03-28)

Initial release.

### Features

- **FDI Tooth Labeling** — 32 teeth + gingiva/anatomy/pathology labels with auto-generated distinct colors
- **Brush Tool** — Radius-based vertex painting with drag interpolation and 3D cursor
- **Eraser Tool** — Remove labels from vertices
- **Flood Fill Tool** — BFS adjacency-based region filling with same-label-only option
- **Undo/Redo** — Full command-pattern history (Cmd/Ctrl+Z / Cmd/Ctrl+Shift+Z)
- **Export** — Binary PLY with vertex colors + JSON sidecar with label statistics
- **Camera Presets** — 7 dental view angles (front/back/left/right/top/bottom/occlusal)
- **Lighting Controls** — Camera headlight, ambient intensity, directional lights
- **FDI Quick Select** — 4×8 grid for rapid tooth selection
- **Label Filtering** — Filter by category (Teeth/Gingiva/Anatomy/Pathology)
- **Drag & Drop Import** — PLY/STL/OBJ file import

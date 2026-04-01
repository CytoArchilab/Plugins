/**
 * EraserTool.js — Brush with label=0 (erase to unlabeled).
 *
 * Copyright (c) CytoArchiLab. All rights reserved.
 */

import { BrushTool } from './BrushTool.js';

class EraserTool extends BrushTool {
    constructor(editor, vertexLabelManager, labelSchema) {
        super(editor, vertexLabelManager, labelSchema);
        this.name = 'Eraser';
    }

    /** Always erase to label 0 regardless of currentLabel. */
    _getLabelForStroke() {
        return 0;
    }
}

export { EraserTool };

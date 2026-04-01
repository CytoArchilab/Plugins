/**
 * LabelCommands.js — Undo/redo commands compatible with Three.js editor.
 *
 * Copyright (c) CytoArchiLab. All rights reserved.
 *
 * The Three.js editor uses editor.execute(command) with Command objects
 * that implement execute() and undo(). We follow the same pattern.
 */

class SetLabelCommand {
    /**
     * Command that sets vertex labels and syncs vertex colors.
     * Uses delta storage: only stores changed indices and their old values.
     *
     * @param {object} editor - Three.js editor instance
     * @param {string} meshUuid - UUID of the mesh being painted
     * @param {number[]} indices - Vertex indices to change
     * @param {number} newLabel - New label ID to apply
     * @param {Int32Array|null} oldLabels - Previous label values (captured before execution)
     * @param {object} vertexLabelManager - VertexLabelManager instance
     * @param {object} labelSchema - LabelSchema instance
     */
    constructor(editor, meshUuid, indices, newLabel, oldLabels, vertexLabelManager, labelSchema) {
        this.type = 'SetLabelCommand';
        this.editor = editor;
        this.meshUuid = meshUuid;
        this.indices = indices;
        this.newLabel = newLabel;
        this.oldLabels = oldLabels; // Int32Array of old values per index
        this.vertexLabelManager = vertexLabelManager;
        this.labelSchema = labelSchema;
        this.name = `Paint ${indices.length} vertices → label ${newLabel}`;
    }

    execute() {
        this.vertexLabelManager.setLabels(this.meshUuid, this.indices, this.newLabel);
        const mesh = this.editor.scene.getObjectByProperty('uuid', this.meshUuid);
        if (mesh) {
            this.vertexLabelManager.syncColors(mesh, this.labelSchema);
        }
        if (this.editor.signals.vertexPainted) {
            this.editor.signals.vertexPainted.dispatch(this.meshUuid, this.indices, this.newLabel);
        }
    }

    undo() {
        // Restore old labels one by one
        const labels = this.vertexLabelManager.getLabelsArray(this.meshUuid);
        if (labels) {
            for (let i = 0; i < this.indices.length; i++) {
                labels[this.indices[i]] = this.oldLabels[i];
            }
        }
        const mesh = this.editor.scene.getObjectByProperty('uuid', this.meshUuid);
        if (mesh) {
            this.vertexLabelManager.syncColors(mesh, this.labelSchema);
        }
        if (this.editor.signals.vertexPainted) {
            this.editor.signals.vertexPainted.dispatch(this.meshUuid, this.indices, null);
        }
    }

    toJSON() {
        return {
            type: this.type,
            meshUuid: this.meshUuid,
            indices: Array.from(this.indices),
            newLabel: this.newLabel,
            oldLabels: Array.from(this.oldLabels)
        };
    }

    fromJSON(json) {
        this.meshUuid = json.meshUuid;
        this.indices = json.indices;
        this.newLabel = json.newLabel;
        this.oldLabels = new Int32Array(json.oldLabels);
    }
}

export { SetLabelCommand };

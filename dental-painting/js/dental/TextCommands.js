/**
 * TextCommands.js — Undo/redo commands for text annotations.
 *
 * Copyright (c) CytoArchiLab. All rights reserved.
 */

import * as THREE from 'three';

class AddAnnotationCommand {
    constructor(editor, annManager, type, text, params) {
        this.editor = editor;
        this.annManager = annManager;
        this.type = type;
        this.text = text;
        this.params = params;
        this.annId = null;
        this.name = 'Add annotation';
    }

    execute() {
        this.annId = this.annManager.addAnchor(
            this.params.worldPos,
            this.params.normal,
            this.text,
            this.params.meshUuid,
            this.params.color,
            this.params.marker,
            this.annId
        );
    }

    undo() {
        this.annManager.remove(this.annId);
    }
}

class RemoveAnnotationCommand {
    constructor(editor, annManager, annId) {
        this.editor = editor;
        this.annManager = annManager;
        this.annId = annId;
        this.name = 'Remove annotation';
        this._snapshot = null;
    }

    execute() {
        const ann = this.annManager.get(this.annId);
        if (!ann) return;
        this._snapshot = {
            worldPos: ann.worldPos.clone(),
            normal: ann.normal.clone(),
            text: ann.text,
            meshUuid: ann.meshUuid,
            color: ann.color,
            marker: ann.marker,
        };
        this.annManager.remove(this.annId);
    }

    undo() {
        if (!this._snapshot) return;
        const s = this._snapshot;
        this.annManager.addAnchor(s.worldPos, s.normal, s.text, s.meshUuid, s.color, s.marker, this.annId);
    }
}

class EditAnnotationCommand {
    constructor(editor, annManager, annId, newText) {
        this.editor = editor;
        this.annManager = annManager;
        this.annId = annId;
        this.newText = newText;
        this.oldText = null;
        this.name = 'Edit annotation';
    }

    execute() {
        this.oldText = this.annManager.updateText(this.annId, this.newText);
    }

    undo() {
        if (this.oldText !== null) {
            this.annManager.updateText(this.annId, this.oldText);
        }
    }
}

export { AddAnnotationCommand, RemoveAnnotationCommand, EditAnnotationCommand };

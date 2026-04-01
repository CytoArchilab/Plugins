/**
 * FloodFillTool.js — BFS adjacency-based flood fill.
 *
 * Copyright (c) CytoArchiLab. All rights reserved.
 */

import { SetLabelCommand } from './LabelCommands.js';
import * as THREE from 'three';

class FloodFillTool {
    constructor(editor, vertexLabelManager, labelSchema) {
        this.editor = editor;
        this.vlm = vertexLabelManager;
        this.schema = labelSchema;
        this.name = 'Fill';

        this.active = false;
        this.currentLabel = 1;
        this.sameLabelOnly = false;

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        this.MAX_FILL = 500000;

        this._onPointerDown = this._handlePointerDown.bind(this);
        this._activeMesh = null;
        this._canvas = null;
    }

    activate(canvas) {
        this.active = true;
        this._canvas = canvas;
        canvas.addEventListener('pointerdown', this._onPointerDown);
        canvas.style.cursor = 'crosshair';
    }

    deactivate() {
        this.active = false;
        if (this._canvas) {
            this._canvas.removeEventListener('pointerdown', this._onPointerDown);
            this._canvas.style.cursor = '';
            this._canvas = null;
        }
    }

    setActiveMesh(mesh) {
        this._activeMesh = mesh;
    }

    _getCamera() {
        return this.editor.viewportCamera || this.editor.camera;
    }

    _handlePointerDown(event) {
        if (event.button !== 0 || !this._activeMesh) return;

        const rect = this._canvas.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this._getCamera());
        const hits = this.raycaster.intersectObject(this._activeMesh);

        if (hits.length === 0) return;

        event.preventDefault();

        const hit = hits[0];
        const spatialIndex = this.vlm.getSpatialIndex(this._activeMesh.uuid);
        if (!spatialIndex) return;

        const localPoint = this._activeMesh.worldToLocal(hit.point.clone());
        const nearest = spatialIndex.queryNearest(localPoint);
        if (!nearest) return;

        const vertexId = nearest.index;
        const uuid = this._activeMesh.uuid;
        const labels = this.vlm.getLabelsArray(uuid);
        if (!labels) return;

        const sourceLabel = labels[vertexId];
        const targetLabel = this.currentLabel;

        if (sourceLabel === targetLabel) return;

        const filled = this._bfsFill(uuid, vertexId, sourceLabel, targetLabel);
        if (filled.length === 0) return;

        const oldLabels = this.vlm.captureOldLabels(uuid, filled);

        this.vlm.setLabels(uuid, filled, targetLabel);
        this.vlm.syncColors(this._activeMesh, this.schema);

        const cmd = new SetLabelCommand(
            this.editor, uuid, filled, targetLabel, oldLabels,
            this.vlm, this.schema
        );
        this.editor.history.push(cmd);

        if (this.editor.signals.vertexPainted) {
            this.editor.signals.vertexPainted.dispatch(uuid, filled, targetLabel);
        }
    }

    _bfsFill(uuid, start, sourceLabel, targetLabel) {
        const adj = this.vlm.getAdjacency(uuid);
        const labels = this.vlm.getLabelsArray(uuid);
        if (!adj || !labels) return [];

        const visited = new Set();
        const queue = [start];
        visited.add(start);

        while (queue.length > 0 && visited.size < this.MAX_FILL) {
            const v = queue.shift();
            const neighbors = adj[v];
            if (!neighbors) continue;

            for (const neighbor of neighbors) {
                if (visited.has(neighbor)) continue;

                const nLabel = labels[neighbor];

                if (this.sameLabelOnly) {
                    if (nLabel !== sourceLabel) continue;
                } else {
                    if (nLabel !== 0 && nLabel !== sourceLabel) continue;
                    if (nLabel === targetLabel) continue;
                }

                visited.add(neighbor);
                queue.push(neighbor);
            }
        }

        return Array.from(visited);
    }
}

export { FloodFillTool };

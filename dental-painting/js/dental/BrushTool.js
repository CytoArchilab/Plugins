/**
 * BrushTool.js — Raycaster + radius painting + drag interpolation.
 *
 * Copyright (c) CytoArchiLab. All rights reserved.
 *
 * Mouse mapping:
 *   Left-click drag  = paint with brush
 *   Right-click drag = orbit (handled by OrbitControls)
 *   Scroll           = adjust brush radius
 */

import { SetLabelCommand } from './LabelCommands.js';
import * as THREE from 'three';

class BrushTool {
    constructor(editor, vertexLabelManager, labelSchema) {
        this.editor = editor;
        this.vlm = vertexLabelManager;
        this.schema = labelSchema;
        this.name = 'Brush';

        this.active = false;
        this.brushRadius = 2.0;
        this.currentLabel = 1;

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        // Stroke state
        this._painting = false;
        this._strokeIndices = new Set();
        this._strokeOldLabels = new Map();
        this._lastScreenX = 0;
        this._lastScreenY = 0;
        this._stepSize = 5;

        // Brush cursor
        this._cursorMesh = null;

        // Bound handlers (use pointer events for reliable capture)
        this._onPointerDown = this._handlePointerDown.bind(this);
        this._onPointerMove = this._handlePointerMove.bind(this);
        this._onPointerUp = this._handlePointerUp.bind(this);
        this._onWheel = this._handleWheel.bind(this);
        this._onContextMenu = (e) => e.preventDefault(); // prevent right-click menu

        this._activeMesh = null;
        this._canvas = null; // the actual canvas element
    }

    /**
     * Activate the brush tool.
     * @param {HTMLCanvasElement} canvas - The renderer's canvas element
     */
    activate(canvas) {
        this.active = true;
        this._canvas = canvas;
        canvas.addEventListener('pointerdown', this._onPointerDown);
        canvas.addEventListener('pointermove', this._onPointerMove);
        canvas.addEventListener('pointerup', this._onPointerUp);
        canvas.addEventListener('pointercancel', this._onPointerUp);
        canvas.addEventListener('wheel', this._onWheel, { passive: false });
        canvas.addEventListener('contextmenu', this._onContextMenu);
        this._createCursor();
        canvas.style.cursor = 'crosshair';
    }

    deactivate() {
        this.active = false;
        if (this._canvas) {
            this._canvas.removeEventListener('pointerdown', this._onPointerDown);
            this._canvas.removeEventListener('pointermove', this._onPointerMove);
            this._canvas.removeEventListener('pointerup', this._onPointerUp);
            this._canvas.removeEventListener('pointercancel', this._onPointerUp);
            this._canvas.removeEventListener('wheel', this._onWheel);
            this._canvas.removeEventListener('contextmenu', this._onContextMenu);
            this._canvas.style.cursor = '';
            this._canvas = null;
        }
        this._removeCursor();
        this._painting = false;
    }

    setActiveMesh(mesh) {
        this._activeMesh = mesh;
    }

    _updateMouse(event) {
        const rect = this._canvas.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    }

    _getCamera() {
        return this.editor.viewportCamera || this.editor.camera;
    }

    _handlePointerDown(event) {
        // Only paint on LEFT button (button=0)
        if (event.button !== 0) return;
        if (!this._activeMesh) return;

        this._updateMouse(event);
        this.raycaster.setFromCamera(this.mouse, this._getCamera());
        const hits = this.raycaster.intersectObject(this._activeMesh);

        if (hits.length > 0) {
            // Capture pointer for reliable drag tracking
            this._canvas.setPointerCapture(event.pointerId);
            event.preventDefault();

            this._painting = true;
            this._strokeIndices.clear();
            this._strokeOldLabels.clear();
            this._lastScreenX = event.clientX;
            this._lastScreenY = event.clientY;

            this._paintAtHit(hits[0]);
        }
    }

    _handlePointerMove(event) {
        if (!this._activeMesh) return;

        this._updateMouse(event);
        this._updateCursorPosition();

        if (!this._painting) return;

        // Interpolate between last and current mouse positions
        const dx = event.clientX - this._lastScreenX;
        const dy = event.clientY - this._lastScreenY;
        const dist = Math.hypot(dx, dy);
        const steps = Math.max(1, Math.floor(dist / this._stepSize));

        for (let i = 1; i <= steps; i++) {
            const t = i / steps;
            const sx = this._lastScreenX + t * dx;
            const sy = this._lastScreenY + t * dy;
            this._paintAtScreen(sx, sy);
        }

        this._lastScreenX = event.clientX;
        this._lastScreenY = event.clientY;
    }

    _handlePointerUp(event) {
        if (!this._painting) return;
        this._painting = false;

        // Release pointer capture
        if (this._canvas && event.pointerId !== undefined) {
            try { this._canvas.releasePointerCapture(event.pointerId); } catch (e) {}
        }

        if (this._strokeIndices.size === 0) return;

        // Build old labels from pre-paint captures
        const indices = Array.from(this._strokeIndices);
        const oldLabels = new Int32Array(indices.length);
        for (let i = 0; i < indices.length; i++) {
            oldLabels[i] = this._strokeOldLabels.get(indices[i]) || 0;
        }

        const cmd = new SetLabelCommand(
            this.editor,
            this._activeMesh.uuid,
            indices,
            this._getLabelForStroke(),
            oldLabels,
            this.vlm,
            this.schema
        );

        this.editor.history.push(cmd);

        this._strokeIndices.clear();
        this._strokeOldLabels.clear();

        if (this.editor.signals.vertexPainted) {
            this.editor.signals.vertexPainted.dispatch(
                this._activeMesh.uuid, indices, this._getLabelForStroke()
            );
        }
    }

    _handleWheel(event) {
        if (!this.active) return;
        // Cmd/Ctrl+scroll = zoom (let Editor handle it)
        if (event.metaKey || event.ctrlKey) return;

        // Plain scroll = adjust brush radius
        event.preventDefault();
        event.stopPropagation();

        const delta = event.deltaY > 0 ? -0.3 : 0.3;
        this.brushRadius = Math.max(0.1, Math.min(50, this.brushRadius + delta));

        this._updateCursorScale();

        if (this.editor.signals.brushRadiusChanged) {
            this.editor.signals.brushRadiusChanged.dispatch(this.brushRadius);
        }
    }

    _paintAtHit(hit) {
        const uuid = this._activeMesh.uuid;
        const spatialIndex = this.vlm.getSpatialIndex(uuid);
        if (!spatialIndex) return;

        const localPoint = this._activeMesh.worldToLocal(hit.point.clone());
        const nearbyVerts = spatialIndex.queryRadius(localPoint, this.brushRadius);
        if (nearbyVerts.length === 0) return;

        const newVerts = nearbyVerts.filter(v => !this._strokeIndices.has(v));
        if (newVerts.length === 0) return;

        // Capture old labels BEFORE painting
        const labels = this.vlm.getLabelsArray(uuid);
        for (const v of newVerts) {
            this._strokeOldLabels.set(v, labels ? labels[v] : 0);
            this._strokeIndices.add(v);
        }

        this.vlm.setLabels(uuid, newVerts, this._getLabelForStroke());
        this.vlm.syncColors(this._activeMesh, this.schema);
    }

    _paintAtScreen(screenX, screenY) {
        const rect = this._canvas.getBoundingClientRect();
        this.mouse.x = ((screenX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((screenY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this._getCamera());
        const hits = this.raycaster.intersectObject(this._activeMesh);

        if (hits.length > 0) {
            this._paintAtHit(hits[0]);
        }
    }

    _getLabelForStroke() {
        return this.currentLabel;
    }

    // --- Brush cursor ---

    _createCursor() {
        if (this._cursorMesh) return;
        const geometry = new THREE.RingGeometry(0.95, 1.0, 32);
        const material = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            side: THREE.DoubleSide,
            depthTest: false,
            transparent: true,
            opacity: 0.7
        });
        this._cursorMesh = new THREE.Mesh(geometry, material);
        this._cursorMesh.renderOrder = 999;
        this._cursorMesh.name = '__dental_brush_cursor';
        this._cursorMesh.visible = false;
        this.editor.sceneHelpers.add(this._cursorMesh);
    }

    _removeCursor() {
        if (this._cursorMesh) {
            this.editor.sceneHelpers.remove(this._cursorMesh);
            this._cursorMesh.geometry.dispose();
            this._cursorMesh.material.dispose();
            this._cursorMesh = null;
        }
    }

    _updateCursorPosition() {
        if (!this._cursorMesh || !this._activeMesh) {
            if (this._cursorMesh) this._cursorMesh.visible = false;
            return;
        }

        this.raycaster.setFromCamera(this.mouse, this._getCamera());
        const hits = this.raycaster.intersectObject(this._activeMesh);

        if (hits.length > 0) {
            const hit = hits[0];
            this._cursorMesh.position.copy(hit.point);
            if (hit.face) {
                const normal = hit.face.normal.clone();
                normal.transformDirection(this._activeMesh.matrixWorld);
                this._cursorMesh.lookAt(
                    hit.point.x + normal.x,
                    hit.point.y + normal.y,
                    hit.point.z + normal.z
                );
            }
            this._cursorMesh.visible = true;
            this._updateCursorScale();
        } else {
            this._cursorMesh.visible = false;
        }
    }

    _updateCursorScale() {
        if (this._cursorMesh) {
            this._cursorMesh.scale.setScalar(this.brushRadius);
        }
    }
}

export { BrushTool };

/**
 * TextTool.js — 3D anchor text annotation tool.
 *
 * Copyright (c) CytoArchiLab. All rights reserved.
 */

import * as THREE from 'three';
import { AddAnnotationCommand } from './TextCommands.js';
import { MARKER_ICONS } from './TextAnnotationManager.js';

class TextTool {
    constructor(editor, annotationManager) {
        this.editor = editor;
        this.annManager = annotationManager;
        this.active = false;

        this._raycaster = new THREE.Raycaster();
        this._mouse = new THREE.Vector2();
        this._activeMesh = null;

        // Pending hit — waiting for user to type text in sidebar
        this.pendingHit = null;

        // Preview marker (shown immediately on click, before text is entered)
        this._previewGroup = null;

        this._onPointerDown = this._handlePointerDown.bind(this);
    }

    setActiveMesh(mesh) {
        this._activeMesh = mesh;
    }

    activate(canvas) {
        this._canvas = canvas;
        canvas.addEventListener('pointerdown', this._onPointerDown);
        this.active = true;
    }

    deactivate() {
        if (this._canvas) {
            this._canvas.removeEventListener('pointerdown', this._onPointerDown);
        }
        this.active = false;
        this.pendingHit = null;
        this._removePreview();
    }

    _handlePointerDown(e) {
        if (e.button !== 0) return;
        if (!this._activeMesh) return;

        const rect = this._canvas.getBoundingClientRect();
        this._mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this._mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        this._raycaster.setFromCamera(this._mouse, this.editor.camera);

        const meshes = [];
        this.editor.scene.traverse(obj => { if (obj.isMesh) meshes.push(obj); });
        const hits = this._raycaster.intersectObjects(meshes, false);

        if (hits.length === 0) return;

        const hit = hits[0];
        this.pendingHit = {
            worldPos: hit.point.clone(),
            normal: hit.face ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld) : new THREE.Vector3(0, 1, 0),
            meshUuid: hit.object.uuid,
        };

        // Show preview marker at the hit point
        this._showPreview(hit.point.clone());

        // Notify sidebar to focus the text input
        if (this.editor.signals.textHitPending) {
            this.editor.signals.textHitPending.dispatch();
        }
    }

    _showPreview(worldPos) {
        this._removePreview();

        const color = this.annManager.currentColor;
        const markerKey = this.annManager.currentMarker;
        const iconDef = MARKER_ICONS[markerKey] || MARKER_ICONS.pin;

        // Create a 3D sprite-like marker using a small mesh in sceneHelpers
        // Use a simple approach: add an SVG preview to the annotation overlay
        const svg = this.annManager._svg;
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.style.opacity = '0.6';
        g.dataset.preview = 'true';

        const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        icon.setAttribute('viewBox', iconDef.vb);
        icon.setAttribute('width', String(iconDef.size));
        icon.setAttribute('height', String(iconDef.size));
        icon.setAttribute('x', String(-iconDef.size / 2));
        icon.setAttribute('y', String(-iconDef.size / 2));
        const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        pathEl.setAttribute('d', iconDef.path);
        pathEl.setAttribute('fill', color);
        pathEl.setAttribute('stroke', '#fff');
        pathEl.setAttribute('stroke-width', '0.8');
        icon.appendChild(pathEl);
        g.appendChild(icon);
        svg.appendChild(g);

        this._previewGroup = g;
        this._previewWorldPos = worldPos;

        // Start updating preview position
        this._updatePreview();
    }

    _updatePreview() {
        if (!this._previewGroup || !this._previewWorldPos) return;
        const camera = this.editor.camera;
        const vp = this.editor.viewportElement;
        if (!camera || !vp) return;

        const projected = this._previewWorldPos.clone().project(camera);
        const sx = (projected.x * 0.5 + 0.5) * vp.clientWidth;
        const sy = (-projected.y * 0.5 + 0.5) * vp.clientHeight;

        const dist = camera.position.distanceTo(this._previewWorldPos);
        const refDist = this.editor._sceneSize || 100;
        const scale = Math.max(0.4, Math.min(1.2, refDist / (dist + refDist * 0.5)));

        this._previewGroup.setAttribute('transform', `translate(${sx},${sy}) scale(${scale.toFixed(3)})`);

        if (this._previewGroup.parentNode) {
            this._previewRAF = requestAnimationFrame(() => this._updatePreview());
        }
    }

    _removePreview() {
        if (this._previewGroup) {
            this._previewGroup.remove();
            this._previewGroup = null;
        }
        if (this._previewRAF) {
            cancelAnimationFrame(this._previewRAF);
            this._previewRAF = null;
        }
        this._previewWorldPos = null;
    }

    /**
     * Called by sidebar when user confirms text input.
     */
    confirmText(text) {
        if (!this.pendingHit || !text.trim()) return;

        this._removePreview();

        const cmd = new AddAnnotationCommand(
            this.editor,
            this.annManager,
            'anchor',
            text.trim(),
            {
                worldPos: this.pendingHit.worldPos,
                normal: this.pendingHit.normal,
                meshUuid: this.pendingHit.meshUuid,
                color: this.annManager.currentColor,
                marker: this.annManager.currentMarker,
            }
        );
        cmd.execute();
        this.editor.history.push(cmd);
        this.pendingHit = null;
    }
}

export { TextTool };

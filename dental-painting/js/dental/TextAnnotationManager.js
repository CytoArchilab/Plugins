/**
 * TextAnnotationManager.js — Manages 3D anchor text annotations with color and marker icons.
 *
 * Copyright (c) CytoArchiLab. All rights reserved.
 */

import * as THREE from 'three';

let _nextId = 1;

/** Available marker icons as SVG path data */
const MARKER_ICONS = {
    pin:     { path: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5z', vb: '0 0 24 24', size: 28 },
    flag:    { path: 'M5 2v20h2v-8h4l1 2h7V4h-7L11 2H5zm2 2h3l1 2h5v6h-5l-1-2H7V4z', vb: '0 0 24 24', size: 26 },
    circle:  { path: 'M12 2a10 10 0 100 20 10 10 0 000-20zm0 3a7 7 0 110 14 7 7 0 010-14z', vb: '0 0 24 24', size: 22 },
    diamond: { path: 'M12 1L1 12l11 11 11-11L12 1zm0 3.41L20.59 12 12 20.59 3.41 12 12 4.41z', vb: '0 0 24 24', size: 24 },
    star:    { path: 'M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.27 5.82 21 7 14.14l-5-4.87 6.91-1.01L12 2z', vb: '0 0 24 24', size: 26 },
    cross:   { path: 'M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z', vb: '0 0 24 24', size: 20 },
    arrow:   { path: 'M12 2l-5 9h3v11h4V11h3L12 2z', vb: '0 0 24 24', size: 26 },
    tag:     { path: 'M21.41 11.58l-9-9A2 2 0 0011 2H4a2 2 0 00-2 2v7c0 .55.22 1.05.59 1.42l9 9a2 2 0 002.82 0l7-7a2 2 0 000-2.84zM5.5 7A1.5 1.5 0 117 5.5 1.5 1.5 0 015.5 7z', vb: '0 0 24 24', size: 24 },
};

/** Preset annotation colors */
const ANNOTATION_COLORS = [
    '#e94560', '#4ecdc4', '#f9c74f', '#90be6d',
    '#577590', '#f8961e', '#a855f7', '#ffffff',
];

class TextAnnotationManager {
    constructor(editor) {
        this.editor = editor;
        this._annotations = new Map();

        // Current annotation style
        this.currentColor = ANNOTATION_COLORS[0];
        this.currentMarker = 'pin';

        // Selected annotation for editing
        this.selectedId = null;

        // SVG overlay for markers and leader lines
        this._svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        this._svg.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:5;';

        // HTML overlay for text labels
        this._overlay = document.createElement('div');
        this._overlay.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:6;overflow:hidden;';

        const vp = editor.viewportElement;
        if (vp) {
            vp.style.position = 'relative';
            vp.appendChild(this._svg);
            vp.appendChild(this._overlay);
        }

        this._startLoop();
    }

    _startLoop() {
        const loop = () => {
            this._updatePositions();
            requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
    }

    addAnchor(worldPos, normal, text, meshUuid, color, marker, id) {
        const aid = id || _nextId++;
        if (id && id >= _nextId) _nextId = id + 1;

        const annotation = {
            id: aid,
            type: 'anchor',
            worldPos: worldPos.clone(),
            normal: normal.clone(),
            text,
            meshUuid,
            color: color || this.currentColor,
            marker: marker || this.currentMarker,
            el: null,
            line: null,
            markerGroup: null,
        };

        this._createAnchorDOM(annotation);
        this._annotations.set(aid, annotation);
        return aid;
    }

    remove(id) {
        const ann = this._annotations.get(id);
        if (!ann) return null;
        if (ann.el) ann.el.remove();
        if (ann.line) ann.line.remove();
        if (ann.markerGroup) ann.markerGroup.remove();
        if (this.selectedId === id) this.selectedId = null;
        this._annotations.delete(id);
        return ann;
    }

    updateText(id, newText) {
        const ann = this._annotations.get(id);
        if (!ann) return null;
        const old = ann.text;
        ann.text = newText;
        const span = ann.el.querySelector('.ann-text');
        if (span) span.textContent = newText;
        return old;
    }

    /**
     * Update annotation color — rebuilds marker SVG with new color.
     */
    updateColor(id, newColor) {
        const ann = this._annotations.get(id);
        if (!ann) return;
        const oldColor = ann.color;
        ann.color = newColor;
        // Rebuild marker DOM
        this._removeDOM(ann);
        this._createAnchorDOM(ann);
        return oldColor;
    }

    /**
     * Update annotation marker icon — rebuilds marker SVG.
     */
    updateMarker(id, newMarker) {
        const ann = this._annotations.get(id);
        if (!ann) return;
        const oldMarker = ann.marker;
        ann.marker = newMarker;
        this._removeDOM(ann);
        this._createAnchorDOM(ann);
        return oldMarker;
    }

    /** Select an annotation for editing */
    select(id) {
        // Deselect previous
        if (this.selectedId !== null) {
            const prev = this._annotations.get(this.selectedId);
            if (prev && prev.el) prev.el.classList.remove('ann-selected');
        }
        this.selectedId = id;
        if (id !== null) {
            const ann = this._annotations.get(id);
            if (ann && ann.el) ann.el.classList.add('ann-selected');
        }
        // Notify sidebar
        if (this.editor.signals.annotationSelected) {
            this.editor.signals.annotationSelected.dispatch(id);
        }
    }

    _removeDOM(ann) {
        if (ann.el) ann.el.remove();
        if (ann.line) ann.line.remove();
        if (ann.markerGroup) ann.markerGroup.remove();
    }

    /** Show or hide a single annotation */
    setAnnotationVisible(id, visible) {
        const ann = this._annotations.get(id);
        if (!ann) return;
        ann.hidden = !visible;
    }

    /** Show or hide all annotations */
    setAllVisible(visible) {
        for (const ann of this._annotations.values()) {
            ann.hidden = !visible;
        }
    }

    get(id) { return this._annotations.get(id) || null; }
    getAll() { return Array.from(this._annotations.values()); }

    hitTest(clientX, clientY) {
        const els = document.elementsFromPoint(clientX, clientY);
        for (const el of els) {
            if (el.classList.contains('ann-label')) {
                const id = parseInt(el.dataset.annId);
                if (this._annotations.has(id)) return id;
            }
        }
        return null;
    }

    // --- DOM creation ---

    _createAnchorDOM(ann) {
        const color = ann.color;
        const iconDef = MARKER_ICONS[ann.marker] || MARKER_ICONS.pin;

        // SVG group for marker icon
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.style.pointerEvents = 'none';

        // Icon path — rendered directly without background circle
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

        this._svg.appendChild(g);
        ann.markerGroup = g;

        ann.line = null;

        // HTML label
        const el = document.createElement('div');
        el.className = 'ann-label ann-anchor';
        if (this.selectedId === ann.id) el.classList.add('ann-selected');
        el.dataset.annId = ann.id;
        el.style.pointerEvents = 'auto';
        el.style.borderColor = color;
        el.innerHTML = `<span class="ann-color-dot" style="background:${color}"></span><span class="ann-text">${this._escapeHtml(ann.text)}</span>`;
        this._overlay.appendChild(el);
        ann.el = el;

        // Single click to select
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            this.select(ann.id);
        });

        // Click to select
        el.querySelector('.ann-text').addEventListener('dblclick', (e) => {
            e.stopPropagation();
            this.editor.signals.annotationEditRequested.dispatch(ann.id);
        });
    }

    // --- Frame update with distance-based scaling ---

    _updatePositions() {
        const camera = this.editor.camera;
        const vp = this.editor.viewportElement;
        if (!camera || !vp) return;

        const w = vp.clientWidth;
        const h = vp.clientHeight;
        const camPos = camera.position;

        for (const ann of this._annotations.values()) {
            if (ann.type !== 'anchor') continue;

            const projected = ann.worldPos.clone().project(camera);
            const sx = (projected.x * 0.5 + 0.5) * w;
            const sy = (-projected.y * 0.5 + 0.5) * h;
            const behind = projected.z > 1;

            const hidden = behind || ann.hidden;
            ann.el.style.display = hidden ? 'none' : '';
            ann.markerGroup.style.display = hidden ? 'none' : '';

            if (behind) continue;

            // Distance-based scaling: base scale at distance ~100, clamp 0.4-1.2
            const dist = camPos.distanceTo(ann.worldPos);
            const refDist = this.editor._sceneSize || 100;
            const scale = Math.max(0.4, Math.min(1.2, refDist / (dist + refDist * 0.5)));

            // Position and scale marker icon
            ann.markerGroup.setAttribute('transform', `translate(${sx},${sy}) scale(${scale.toFixed(3)})`);

            // Position label with offset scaled by distance
            const offsetX = 20 * scale;
            const offsetY = 20 * scale;
            const labelX = sx + offsetX;
            const labelY = sy - offsetY;
            ann.el.style.left = labelX + 'px';
            ann.el.style.top = labelY + 'px';
            ann.el.style.transform = `scale(${scale.toFixed(3)})`;
            ann.el.style.transformOrigin = '0% 100%';

        }
    }

    _escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    toJSON() {
        const result = [];
        for (const ann of this._annotations.values()) {
            result.push({
                id: ann.id,
                type: 'anchor',
                position: [ann.worldPos.x, ann.worldPos.y, ann.worldPos.z],
                normal: [ann.normal.x, ann.normal.y, ann.normal.z],
                text: ann.text,
                color: ann.color,
                marker: ann.marker,
                meshUuid: ann.meshUuid,
            });
        }
        return result;
    }
}

export { TextAnnotationManager, ANNOTATION_COLORS, MARKER_ICONS };

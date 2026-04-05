/**
 * VertexLabelManager.js — Per-vertex label storage + vertex color sync.
 *
 * Copyright (c) CytoArchiLab. All rights reserved.
 */

import { SpatialIndex } from './SpatialIndex.js';
import * as THREE from 'three';

class VertexLabelManager {
    constructor() {
        // meshUuid → Int32Array of per-vertex labels
        this._labels = new Map();
        // meshUuid → SpatialIndex
        this._spatialIndices = new Map();
        // meshUuid → adjacency list (array of arrays)
        this._adjacency = new Map();
        // meshUuid → Float32Array of original vertex colors from file
        this._originalColors = new Map();
        // Color mode: 'original' = show PLY colors, 'label' = show label colors
        this.colorMode = 'original';
    }

    /**
     * Initialize labels for a mesh. Call when a new mesh is added.
     * @param {THREE.Mesh} mesh
     */
    initMesh(mesh) {
        const geometry = mesh.geometry;
        if (!geometry || !geometry.attributes.position) return;

        const count = geometry.attributes.position.count;
        const uuid = mesh.uuid;

        // Initialize labels to 0 (unlabeled)
        this._labels.set(uuid, new Int32Array(count));

        // Save original vertex colors from PLY/mesh before overwriting
        if (geometry.attributes.color) {
            this._originalColors.set(uuid, new Float32Array(geometry.attributes.color.array));
        } else {
            // No original colors — create default gray
            const defaultColors = new Float32Array(count * 3);
            for (let i = 0; i < count * 3; i++) {
                defaultColors[i] = 0.5;
            }
            this._originalColors.set(uuid, defaultColors);
            geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(defaultColors), 3));
        }

        // Set material to use vertex colors
        if (mesh.material) {
            if (Array.isArray(mesh.material)) {
                mesh.material.forEach(m => {
                    m.vertexColors = true;
                    m.needsUpdate = true;
                });
            } else {
                mesh.material.vertexColors = true;
                mesh.material.side = THREE.DoubleSide;
                mesh.material.needsUpdate = true;
            }
        }

        // Build spatial index
        const spatialIndex = new SpatialIndex();
        spatialIndex.build(geometry.attributes.position);
        this._spatialIndices.set(uuid, spatialIndex);

        // Build adjacency
        this._buildAdjacency(uuid, geometry);
    }

    /**
     * Remove tracking for a mesh.
     * @param {string} uuid
     */
    removeMesh(uuid) {
        this._labels.delete(uuid);
        this._spatialIndices.delete(uuid);
        this._adjacency.delete(uuid);
    }

    /**
     * Set labels for given vertex indices.
     * @param {string} meshUuid
     * @param {number[]} indices
     * @param {number} labelId
     */
    setLabels(meshUuid, indices, labelId) {
        const labels = this._labels.get(meshUuid);
        if (!labels) return;
        for (const idx of indices) {
            if (idx >= 0 && idx < labels.length) {
                labels[idx] = labelId;
            }
        }
    }

    /**
     * Get label for a single vertex.
     * @param {string} meshUuid
     * @param {number} vertexIndex
     * @returns {number}
     */
    getLabel(meshUuid, vertexIndex) {
        const labels = this._labels.get(meshUuid);
        if (!labels || vertexIndex < 0 || vertexIndex >= labels.length) return 0;
        return labels[vertexIndex];
    }

    /**
     * Get the raw labels array for a mesh.
     * @param {string} meshUuid
     * @returns {Int32Array|null}
     */
    getLabelsArray(meshUuid) {
        return this._labels.get(meshUuid) || null;
    }

    /**
     * Capture old label values for given indices (for undo).
     * @param {string} meshUuid
     * @param {number[]} indices
     * @returns {Int32Array}
     */
    captureOldLabels(meshUuid, indices) {
        const labels = this._labels.get(meshUuid);
        const old = new Int32Array(indices.length);
        if (labels) {
            for (let i = 0; i < indices.length; i++) {
                old[i] = labels[indices[i]] || 0;
            }
        }
        return old;
    }

    /**
     * Sync vertex colors from labels using the schema.
     * @param {THREE.Mesh} mesh
     * @param {LabelSchema} schema
     */
    syncColors(mesh, schema) {
        const labels = this._labels.get(mesh.uuid);
        if (!labels) return;

        const geometry = mesh.geometry;
        let colorAttr = geometry.attributes.color;
        if (!colorAttr) {
            const colors = new Float32Array(labels.length * 3);
            colorAttr = new THREE.BufferAttribute(colors, 3);
            geometry.setAttribute('color', colorAttr);
        }

        const colors = colorAttr.array;
        const origColors = this._originalColors.get(mesh.uuid);

        for (let i = 0; i < labels.length; i++) {
            if (this.colorMode === 'original') {
                // Show original colors; only override labeled vertices
                if (labels[i] !== 0) {
                    const [r, g, b] = schema.getColorFloat(labels[i]);
                    colors[i * 3] = r;
                    colors[i * 3 + 1] = g;
                    colors[i * 3 + 2] = b;
                } else if (origColors) {
                    colors[i * 3] = origColors[i * 3];
                    colors[i * 3 + 1] = origColors[i * 3 + 1];
                    colors[i * 3 + 2] = origColors[i * 3 + 2];
                }
            } else {
                // Label mode: all vertices show label color
                const [r, g, b] = schema.getColorFloat(labels[i]);
                colors[i * 3] = r;
                colors[i * 3 + 1] = g;
                colors[i * 3 + 2] = b;
            }
        }
        colorAttr.needsUpdate = true;

        // Ensure material uses vertex colors
        if (mesh.material && !mesh.material.vertexColors) {
            mesh.material.vertexColors = true;
            mesh.material.needsUpdate = true;
        }
    }

    /**
     * Get the spatial index for a mesh.
     * @param {string} meshUuid
     * @returns {SpatialIndex|null}
     */
    getSpatialIndex(meshUuid) {
        return this._spatialIndices.get(meshUuid) || null;
    }

    /**
     * Get adjacency list for a mesh.
     * @param {string} meshUuid
     * @returns {Array<number[]>|null}
     */
    getAdjacency(meshUuid) {
        return this._adjacency.get(meshUuid) || null;
    }

    /**
     * Get vertex count for a mesh.
     * @param {string} meshUuid
     * @returns {number}
     */
    getVertexCount(meshUuid) {
        const labels = this._labels.get(meshUuid);
        return labels ? labels.length : 0;
    }

    /**
     * Compute label statistics for a mesh.
     * @param {string} meshUuid
     * @param {LabelSchema} schema
     * @returns {Array<{labelId: number, name: string, count: number}>}
     */
    computeStats(meshUuid, schema) {
        const labels = this._labels.get(meshUuid);
        if (!labels) return [];

        const counts = new Map();
        for (let i = 0; i < labels.length; i++) {
            const lid = labels[i];
            counts.set(lid, (counts.get(lid) || 0) + 1);
        }

        const stats = [];
        for (const [lid, count] of counts) {
            const lbl = schema.get(lid);
            stats.push({
                labelId: lid,
                name: lbl ? lbl.name : `Unknown (${lid})`,
                count
            });
        }
        return stats.sort((a, b) => a.labelId - b.labelId);
    }

    /**
     * Build vertex adjacency from index buffer.
     * @private
     */
    _buildAdjacency(uuid, geometry) {
        const posCount = geometry.attributes.position.count;
        const adj = new Array(posCount);
        for (let i = 0; i < posCount; i++) {
            adj[i] = [];
        }

        const index = geometry.index;
        if (index) {
            const indices = index.array;
            for (let i = 0; i < indices.length; i += 3) {
                const a = indices[i], b = indices[i + 1], c = indices[i + 2];
                if (!adj[a].includes(b)) adj[a].push(b);
                if (!adj[a].includes(c)) adj[a].push(c);
                if (!adj[b].includes(a)) adj[b].push(a);
                if (!adj[b].includes(c)) adj[b].push(c);
                if (!adj[c].includes(a)) adj[c].push(a);
                if (!adj[c].includes(b)) adj[c].push(b);
            }
        } else {
            // Non-indexed geometry: every 3 vertices form a triangle
            for (let i = 0; i < posCount; i += 3) {
                const a = i, b = i + 1, c = i + 2;
                if (b < posCount && c < posCount) {
                    adj[a].push(b, c);
                    adj[b].push(a, c);
                    adj[c].push(a, b);
                }
            }
        }

        this._adjacency.set(uuid, adj);
    }
}

export { VertexLabelManager };

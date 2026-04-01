/**
 * SpatialIndex.js — Grid-based spatial index for fast radius vertex queries.
 *
 * Copyright (c) CytoArchiLab. All rights reserved.
 *
 * For dental meshes (~100K vertices) a simple grid-based spatial index
 * provides good performance without heavy dependencies.
 */

class SpatialIndex {
    constructor() {
        this.positions = null; // Float32Array (flattened xyz)
        this.count = 0;
        this.cellSize = 0;
        this.grid = null; // Map<string, number[]>
        this.minBounds = [0, 0, 0];
    }

    /**
     * Build the spatial index from vertex positions.
     * @param {Float32Array|THREE.BufferAttribute} positions - Vertex positions (xyz interleaved)
     * @param {number} [cellSize=0] - Grid cell size. 0 = auto-compute.
     */
    build(positions, cellSize = 0) {
        // Accept either BufferAttribute or raw Float32Array
        if (positions.array) {
            this.positions = positions.array;
        } else {
            this.positions = positions;
        }
        this.count = this.positions.length / 3;

        // Compute bounding box
        let minX = Infinity, minY = Infinity, minZ = Infinity;
        let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
        for (let i = 0; i < this.count; i++) {
            const x = this.positions[i * 3];
            const y = this.positions[i * 3 + 1];
            const z = this.positions[i * 3 + 2];
            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (z < minZ) minZ = z;
            if (x > maxX) maxX = x;
            if (y > maxY) maxY = y;
            if (z > maxZ) maxZ = z;
        }
        this.minBounds = [minX, minY, minZ];

        // Auto cell size: aim for ~10 vertices per cell on average
        if (cellSize <= 0) {
            const vol = (maxX - minX) * (maxY - minY) * (maxZ - minZ);
            const avgDensity = this.count / Math.max(vol, 1e-10);
            // Cell volume to hold ~10 verts
            this.cellSize = Math.cbrt(10 / avgDensity);
            // Clamp to reasonable range
            const diagonal = Math.sqrt(
                (maxX - minX) ** 2 + (maxY - minY) ** 2 + (maxZ - minZ) ** 2
            );
            this.cellSize = Math.max(this.cellSize, diagonal * 0.001);
            this.cellSize = Math.min(this.cellSize, diagonal * 0.1);
        } else {
            this.cellSize = cellSize;
        }

        // Build grid
        this.grid = new Map();
        const invCell = 1 / this.cellSize;
        for (let i = 0; i < this.count; i++) {
            const cx = Math.floor((this.positions[i * 3] - minX) * invCell);
            const cy = Math.floor((this.positions[i * 3 + 1] - minY) * invCell);
            const cz = Math.floor((this.positions[i * 3 + 2] - minZ) * invCell);
            const key = `${cx},${cy},${cz}`;
            let bucket = this.grid.get(key);
            if (!bucket) {
                bucket = [];
                this.grid.set(key, bucket);
            }
            bucket.push(i);
        }
    }

    /**
     * Find all vertices within radius of a point.
     * @param {THREE.Vector3|number[]} point - Query point [x, y, z]
     * @param {number} radius - Search radius
     * @returns {number[]} Array of vertex indices within radius
     */
    queryRadius(point, radius) {
        if (!this.grid) return [];

        const px = point.x !== undefined ? point.x : point[0];
        const py = point.x !== undefined ? point.y : point[1];
        const pz = point.x !== undefined ? point.z : point[2];
        const r2 = radius * radius;
        const invCell = 1 / this.cellSize;
        const [minX, minY, minZ] = this.minBounds;

        // Determine cell range to search
        const cxMin = Math.floor((px - radius - minX) * invCell);
        const cxMax = Math.floor((px + radius - minX) * invCell);
        const cyMin = Math.floor((py - radius - minY) * invCell);
        const cyMax = Math.floor((py + radius - minY) * invCell);
        const czMin = Math.floor((pz - radius - minZ) * invCell);
        const czMax = Math.floor((pz + radius - minZ) * invCell);

        const result = [];
        for (let cx = cxMin; cx <= cxMax; cx++) {
            for (let cy = cyMin; cy <= cyMax; cy++) {
                for (let cz = czMin; cz <= czMax; cz++) {
                    const bucket = this.grid.get(`${cx},${cy},${cz}`);
                    if (!bucket) continue;
                    for (const idx of bucket) {
                        const dx = this.positions[idx * 3] - px;
                        const dy = this.positions[idx * 3 + 1] - py;
                        const dz = this.positions[idx * 3 + 2] - pz;
                        if (dx * dx + dy * dy + dz * dz <= r2) {
                            result.push(idx);
                        }
                    }
                }
            }
        }
        return result;
    }

    /**
     * Find the nearest vertex to a point.
     * @param {THREE.Vector3|number[]} point - Query point
     * @returns {{index: number, distance: number}|null}
     */
    queryNearest(point) {
        if (!this.grid || this.count === 0) return null;

        const px = point.x !== undefined ? point.x : point[0];
        const py = point.x !== undefined ? point.y : point[1];
        const pz = point.x !== undefined ? point.z : point[2];

        let bestIdx = -1;
        let bestDist2 = Infinity;

        // Start with nearby cells and expand
        const invCell = 1 / this.cellSize;
        const [minX, minY, minZ] = this.minBounds;
        const ccx = Math.floor((px - minX) * invCell);
        const ccy = Math.floor((py - minY) * invCell);
        const ccz = Math.floor((pz - minZ) * invCell);

        for (let r = 0; r <= 3; r++) {
            for (let cx = ccx - r; cx <= ccx + r; cx++) {
                for (let cy = ccy - r; cy <= ccy + r; cy++) {
                    for (let cz = ccz - r; cz <= ccz + r; cz++) {
                        const bucket = this.grid.get(`${cx},${cy},${cz}`);
                        if (!bucket) continue;
                        for (const idx of bucket) {
                            const dx = this.positions[idx * 3] - px;
                            const dy = this.positions[idx * 3 + 1] - py;
                            const dz = this.positions[idx * 3 + 2] - pz;
                            const d2 = dx * dx + dy * dy + dz * dz;
                            if (d2 < bestDist2) {
                                bestDist2 = d2;
                                bestIdx = idx;
                            }
                        }
                    }
                }
            }
            if (bestIdx >= 0) break;
        }

        if (bestIdx < 0) return null;
        return { index: bestIdx, distance: Math.sqrt(bestDist2) };
    }
}

export { SpatialIndex };

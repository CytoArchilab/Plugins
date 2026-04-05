/**
 * DentalExporter.js — Export labeled mesh as colored PLY + JSON sidecar.
 *
 * Copyright (c) CytoArchiLab. All rights reserved.
 */

class DentalExporter {
    /**
     * @param {object} vertexLabelManager
     * @param {object} labelSchema
     */
    constructor(vertexLabelManager, labelSchema, annotationManager) {
        this.vlm = vertexLabelManager;
        this.schema = labelSchema;
        this.annManager = annotationManager || null;
    }

    /**
     * Export a mesh as a colored PLY file.
     * @param {THREE.Mesh} mesh
     * @returns {Blob} PLY file blob
     */
    exportPLY(mesh) {
        const geometry = mesh.geometry;
        const positions = geometry.attributes.position;
        const normals = geometry.attributes.normal;
        const labels = this.vlm.getLabelsArray(mesh.uuid);
        const count = positions.count;
        const index = geometry.index;

        // Build PLY header
        let header = 'ply\n';
        header += 'format ascii 1.0\n';
        header += `element vertex ${count}\n`;
        header += 'property float x\n';
        header += 'property float y\n';
        header += 'property float z\n';
        if (normals) {
            header += 'property float nx\n';
            header += 'property float ny\n';
            header += 'property float nz\n';
        }
        header += 'property uchar red\n';
        header += 'property uchar green\n';
        header += 'property uchar blue\n';
        header += 'property int label\n';

        const faceCount = index ? index.count / 3 : count / 3;
        header += `element face ${faceCount}\n`;
        header += 'property list uchar int vertex_indices\n';
        header += 'end_header\n';

        // Build vertex data
        const lines = [header];
        for (let i = 0; i < count; i++) {
            const x = positions.getX(i).toFixed(6);
            const y = positions.getY(i).toFixed(6);
            const z = positions.getZ(i).toFixed(6);

            let line = `${x} ${y} ${z}`;

            if (normals) {
                const nx = normals.getX(i).toFixed(6);
                const ny = normals.getY(i).toFixed(6);
                const nz = normals.getZ(i).toFixed(6);
                line += ` ${nx} ${ny} ${nz}`;
            }

            const labelId = labels ? labels[i] : 0;
            const [r, g, b] = this.schema.getColor(labelId);
            line += ` ${r} ${g} ${b} ${labelId}`;

            lines.push(line + '\n');
        }

        // Build face data
        if (index) {
            for (let i = 0; i < index.count; i += 3) {
                lines.push(`3 ${index.getX(i)} ${index.getX(i + 1)} ${index.getX(i + 2)}\n`);
            }
        } else {
            for (let i = 0; i < count; i += 3) {
                lines.push(`3 ${i} ${i + 1} ${i + 2}\n`);
            }
        }

        return new Blob(lines, { type: 'application/octet-stream' });
    }

    /**
     * Export a binary PLY file (more compact).
     * @param {THREE.Mesh} mesh
     * @returns {Blob}
     */
    exportPLYBinary(mesh) {
        const geometry = mesh.geometry;
        const positions = geometry.attributes.position;
        const normals = geometry.attributes.normal;
        const labels = this.vlm.getLabelsArray(mesh.uuid);
        const count = positions.count;
        const index = geometry.index;
        const faceCount = index ? index.count / 3 : count / 3;

        const hasNormals = !!normals;

        let header = 'ply\n';
        header += 'format binary_little_endian 1.0\n';
        header += `element vertex ${count}\n`;
        header += 'property float x\nproperty float y\nproperty float z\n';
        if (hasNormals) {
            header += 'property float nx\nproperty float ny\nproperty float nz\n';
        }
        header += 'property uchar red\nproperty uchar green\nproperty uchar blue\n';
        header += 'property int label\n';
        header += `element face ${faceCount}\n`;
        header += 'property list uchar int vertex_indices\n';
        header += 'end_header\n';

        const headerBytes = new TextEncoder().encode(header);

        // Vertex data: (3 or 6 floats + 3 bytes + 1 int) per vertex
        const floatsPerVert = hasNormals ? 6 : 3;
        const vertexByteSize = floatsPerVert * 4 + 3 + 4;
        const vertexBuffer = new ArrayBuffer(count * vertexByteSize);
        const vertView = new DataView(vertexBuffer);

        let offset = 0;
        for (let i = 0; i < count; i++) {
            vertView.setFloat32(offset, positions.getX(i), true); offset += 4;
            vertView.setFloat32(offset, positions.getY(i), true); offset += 4;
            vertView.setFloat32(offset, positions.getZ(i), true); offset += 4;
            if (hasNormals) {
                vertView.setFloat32(offset, normals.getX(i), true); offset += 4;
                vertView.setFloat32(offset, normals.getY(i), true); offset += 4;
                vertView.setFloat32(offset, normals.getZ(i), true); offset += 4;
            }
            const labelId = labels ? labels[i] : 0;
            const [r, g, b] = this.schema.getColor(labelId);
            vertView.setUint8(offset, r); offset += 1;
            vertView.setUint8(offset, g); offset += 1;
            vertView.setUint8(offset, b); offset += 1;
            vertView.setInt32(offset, labelId, true); offset += 4;
        }

        // Face data: 1 byte (3) + 3 ints per face
        const faceByteSize = 1 + 3 * 4;
        const faceBuffer = new ArrayBuffer(faceCount * faceByteSize);
        const faceView = new DataView(faceBuffer);

        offset = 0;
        if (index) {
            for (let i = 0; i < index.count; i += 3) {
                faceView.setUint8(offset, 3); offset += 1;
                faceView.setInt32(offset, index.getX(i), true); offset += 4;
                faceView.setInt32(offset, index.getX(i + 1), true); offset += 4;
                faceView.setInt32(offset, index.getX(i + 2), true); offset += 4;
            }
        } else {
            for (let i = 0; i < count; i += 3) {
                faceView.setUint8(offset, 3); offset += 1;
                faceView.setInt32(offset, i, true); offset += 4;
                faceView.setInt32(offset, i + 1, true); offset += 4;
                faceView.setInt32(offset, i + 2, true); offset += 4;
            }
        }

        return new Blob([headerBytes, vertexBuffer, faceBuffer], { type: 'application/octet-stream' });
    }

    /**
     * Export JSON sidecar with label schema and statistics.
     * @param {THREE.Mesh} mesh
     * @returns {Blob}
     */
    exportJSON(mesh) {
        const stats = this.vlm.computeStats(mesh.uuid, this.schema);
        const geometry = mesh.geometry;

        const sidecar = {
            source_file: (mesh.name || 'mesh') + '.ply',
            label_mode: 'vertex',
            n_vertices: geometry.attributes.position.count,
            n_faces: geometry.index ? geometry.index.count / 3 : geometry.attributes.position.count / 3,
            schema: this.schema.toJSON(),
            label_stats: stats,
            annotations: this.annManager ? this.annManager.toJSON() : []
        };

        const json = JSON.stringify(sidecar, null, 2);
        return new Blob([json], { type: 'application/json' });
    }

    /**
     * Download a blob as a file.
     * @param {Blob} blob
     * @param {string} filename
     */
    static download(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

export { DentalExporter };

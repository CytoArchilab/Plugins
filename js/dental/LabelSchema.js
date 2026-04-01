/**
 * LabelSchema.js — FDI dental label definitions + colors.
 *
 * Copyright (c) CytoArchiLab. All rights reserved.
 */

class LabelDefinition {
    /**
     * @param {number} id - Unique label ID (0 = unlabeled)
     * @param {string} name - Human-readable name
     * @param {number[]} color - RGB color [0-255, 0-255, 0-255]
     * @param {string} category - "tooth" | "gingiva" | "anatomy" | "pathology" | "background"
     * @param {number|null} fdiNumber - FDI tooth number (11-48) or null
     */
    constructor(id, name, color, category = 'tooth', fdiNumber = null) {
        this.id = id;
        this.name = name;
        this.color = color;
        this.category = category;
        this.fdiNumber = fdiNumber;
    }
}

class LabelSchema {
    constructor(labels = null) {
        this._labels = new Map();
        // Always include label 0
        this._labels.set(0, new LabelDefinition(
            0, 'Unlabeled', [128, 128, 128], 'background', null
        ));
        if (labels) {
            for (const lbl of labels) {
                this._labels.set(lbl.id, lbl);
            }
        }
    }

    add(label) {
        this._labels.set(label.id, label);
    }

    remove(labelId) {
        if (labelId === 0) throw new Error('Cannot remove the unlabeled (0) label');
        this._labels.delete(labelId);
    }

    get(labelId) {
        return this._labels.get(labelId) || null;
    }

    getColor(labelId) {
        const lbl = this._labels.get(labelId);
        return lbl ? lbl.color : [128, 128, 128];
    }

    /** @returns {number[]} [r, g, b] in 0-1 range for Three.js */
    getColorFloat(labelId) {
        const [r, g, b] = this.getColor(labelId);
        return [r / 255, g / 255, b / 255];
    }

    get allLabels() {
        return Array.from(this._labels.values()).sort((a, b) => a.id - b.id);
    }

    get labelIds() {
        return Array.from(this._labels.keys()).sort((a, b) => a - b);
    }

    get toothLabels() {
        return this.allLabels.filter(l => l.category === 'tooth');
    }

    nextId() {
        if (this._labels.size === 0) return 1;
        return Math.max(...this._labels.keys()) + 1;
    }

    get size() {
        return this._labels.size;
    }

    has(labelId) {
        return this._labels.has(labelId);
    }

    // --- Serialization ---

    toJSON() {
        return this.allLabels.map(lbl => ({
            id: lbl.id,
            name: lbl.name,
            color: [...lbl.color],
            category: lbl.category,
            fdi_number: lbl.fdiNumber
        }));
    }

    static fromJSON(data) {
        const labels = data.map(d => new LabelDefinition(
            d.id, d.name, d.color, d.category, d.fdi_number
        ));
        return new LabelSchema(labels);
    }
}

/**
 * Create the default FDI dental label schema (32 teeth + extras).
 * Uses golden ratio color generation for maximally distinct colors.
 */
function createDefaultSchema() {
    const schema = new LabelSchema();

    const quadrantNames = { 1: 'UR', 2: 'UL', 3: 'LL', 4: 'LR' };
    const positionNames = {
        1: 'Central Incisor', 2: 'Lateral Incisor', 3: 'Canine',
        4: 'First Premolar', 5: 'Second Premolar',
        6: 'First Molar', 7: 'Second Molar', 8: 'Third Molar'
    };

    const goldenRatio = (1 + Math.sqrt(5)) / 2;
    let labelId = 1;

    for (let quadrant = 1; quadrant <= 4; quadrant++) {
        for (let position = 1; position <= 8; position++) {
            const fdi = quadrant * 10 + position;
            const hue = ((labelId - 1) / goldenRatio) % 1.0;
            const sat = 0.65 + 0.2 * ((labelId % 3) / 2.0);
            const val = 0.75 + 0.15 * ((labelId % 4) / 3.0);
            const [r, g, b] = hsvToRgb(hue, sat, val);
            const color = [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
            const name = `${quadrantNames[quadrant]} ${positionNames[position]} (${fdi})`;
            schema.add(new LabelDefinition(labelId, name, color, 'tooth', fdi));
            labelId++;
        }
    }

    // Gingiva
    schema.add(new LabelDefinition(33, 'Gingiva', [255, 182, 193], 'gingiva'));
    // Anatomy
    schema.add(new LabelDefinition(34, 'Alveolar Bone', [222, 184, 135], 'anatomy'));
    schema.add(new LabelDefinition(35, 'Pulp Chamber', [255, 69, 0], 'anatomy'));
    schema.add(new LabelDefinition(36, 'Root Canal', [255, 140, 0], 'anatomy'));
    // Pathology
    schema.add(new LabelDefinition(37, 'Caries', [139, 0, 0], 'pathology'));
    schema.add(new LabelDefinition(38, 'Fracture', [178, 34, 34], 'pathology'));
    schema.add(new LabelDefinition(39, 'Periapical Lesion', [160, 32, 240], 'pathology'));

    return schema;
}

/** Convert HSV to RGB (all values 0-1). */
function hsvToRgb(h, s, v) {
    let r, g, b;
    const i = Math.floor(h * 6);
    const f = h * 6 - i;
    const p = v * (1 - s);
    const q = v * (1 - f * s);
    const t = v * (1 - (1 - f) * s);
    switch (i % 6) {
        case 0: r = v; g = t; b = p; break;
        case 1: r = q; g = v; b = p; break;
        case 2: r = p; g = v; b = t; break;
        case 3: r = p; g = q; b = v; break;
        case 4: r = t; g = p; b = v; break;
        case 5: r = v; g = p; b = q; break;
    }
    return [r, g, b];
}

export { LabelDefinition, LabelSchema, createDefaultSchema };

/**
 * SidebarDental.js — Sidebar panel: tool buttons, label selector, FDI grid, camera.
 *
 * Copyright (c) CytoArchiLab. All rights reserved.
 */

import { DentalExporter } from './DentalExporter.js';

class SidebarDental {
    constructor(editor, plugin) {
        this.editor = editor;
        this.plugin = plugin;

        this.container = document.createElement('div');
        this.container.className = 'dental-sidebar';

        this._activeTool = 'brush';
        this._build();
        this._bindSignals();
    }

    _build() {
        this._addSection('Tools', this._buildToolButtons());
        this._addSection('Brush Settings', this._buildBrushSettings());
        this._addSection('Current Label', this._buildCurrentLabel());
        this._addSection('FDI Quick Select', this._buildFDIGrid());
        this._addSection('Labels', this._buildLabelList());
        this._addSection('Camera', this._buildCameraPanel());
        this._addSection('Export', this._buildExportButtons());
    }

    _addSection(title, content) {
        const section = document.createElement('div');
        section.className = 'dental-section';

        const header = document.createElement('div');
        header.className = 'dental-section-header';
        header.textContent = title;
        header.addEventListener('click', () => {
            content.style.display = content.style.display === 'none' ? '' : 'none';
            header.classList.toggle('collapsed');
        });

        section.appendChild(header);
        section.appendChild(content);
        this.container.appendChild(section);
    }

    // --- Tool Buttons ---

    _buildToolButtons() {
        const div = document.createElement('div');
        div.className = 'dental-tools';

        const tools = [
            { id: 'brush', label: 'Brush', shortcut: 'B' },
            { id: 'eraser', label: 'Eraser', shortcut: 'E' },
            { id: 'fill', label: 'Fill', shortcut: 'F' }
        ];

        this._toolButtons = {};
        for (const tool of tools) {
            const btn = document.createElement('button');
            btn.className = 'dental-tool-btn';
            btn.textContent = `${tool.label} (${tool.shortcut})`;
            btn.dataset.tool = tool.id;
            btn.addEventListener('click', () => this._selectTool(tool.id));
            div.appendChild(btn);
            this._toolButtons[tool.id] = btn;
        }

        this._toolButtons['brush'].classList.add('active');

        // Usage hint
        const hint = document.createElement('div');
        hint.className = 'dental-hint';
        hint.textContent = 'Left-click: paint | Right-drag: rotate | Scroll: brush size | Cmd/Ctrl+scroll: zoom';
        div.appendChild(hint);

        return div;
    }

    _selectTool(toolId) {
        this._activeTool = toolId;
        for (const [id, btn] of Object.entries(this._toolButtons)) {
            btn.classList.toggle('active', id === toolId);
        }
        this.plugin.setActiveTool(toolId);
    }

    // --- Brush Settings ---

    _buildBrushSettings() {
        const div = document.createElement('div');
        div.className = 'dental-brush-settings';

        const label = document.createElement('label');
        label.textContent = 'Radius: ';

        this._radiusValue = document.createElement('span');
        this._radiusValue.textContent = '2.0';

        this._radiusSlider = document.createElement('input');
        this._radiusSlider.type = 'range';
        this._radiusSlider.min = '0.1';
        this._radiusSlider.max = '20';
        this._radiusSlider.step = '0.1';
        this._radiusSlider.value = '2.0';
        this._radiusSlider.className = 'dental-slider';
        this._radiusSlider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            this._radiusValue.textContent = val.toFixed(1);
            this.plugin.setBrushRadius(val);
        });

        label.appendChild(this._radiusValue);
        div.appendChild(label);
        div.appendChild(this._radiusSlider);

        const fillCheck = document.createElement('label');
        fillCheck.className = 'dental-checkbox-label';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.addEventListener('change', (e) => {
            this.plugin.fillTool.sameLabelOnly = e.target.checked;
        });
        fillCheck.appendChild(cb);
        fillCheck.appendChild(document.createTextNode(' Same label only (fill)'));
        div.appendChild(fillCheck);

        return div;
    }

    // --- Current Label Display ---

    _buildCurrentLabel() {
        const div = document.createElement('div');
        div.className = 'dental-current-label';

        this._labelSwatch = document.createElement('div');
        this._labelSwatch.className = 'dental-color-swatch';

        this._labelName = document.createElement('span');
        this._labelName.className = 'dental-label-name';

        div.appendChild(this._labelSwatch);
        div.appendChild(this._labelName);

        this._updateCurrentLabelDisplay();
        return div;
    }

    _updateCurrentLabelDisplay() {
        const labelId = this.plugin.currentLabel;
        const schema = this.plugin.schema;
        const lbl = schema.get(labelId);
        if (lbl) {
            const [r, g, b] = lbl.color;
            this._labelSwatch.style.backgroundColor = `rgb(${r},${g},${b})`;
            this._labelName.textContent = `${lbl.name} (ID: ${lbl.id})`;
        }
    }

    // --- FDI Quick Select Grid ---

    _buildFDIGrid() {
        const div = document.createElement('div');
        div.className = 'dental-fdi-grid';

        const schema = this.plugin.schema;
        const quadrantNames = ['UR (1)', 'UL (2)', 'LL (3)', 'LR (4)'];

        const table = document.createElement('table');
        table.className = 'dental-fdi-table';

        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        headerRow.appendChild(document.createElement('th'));
        for (let p = 1; p <= 8; p++) {
            const th = document.createElement('th');
            th.textContent = p;
            headerRow.appendChild(th);
        }
        thead.appendChild(headerRow);
        table.appendChild(thead);

        const tbody = document.createElement('tbody');
        for (let q = 1; q <= 4; q++) {
            const row = document.createElement('tr');
            const th = document.createElement('th');
            th.textContent = quadrantNames[q - 1];
            row.appendChild(th);

            for (let p = 1; p <= 8; p++) {
                const fdi = q * 10 + p;
                const td = document.createElement('td');
                const btn = document.createElement('button');
                btn.className = 'dental-fdi-btn';
                btn.textContent = fdi;
                btn.title = this._getFDITooltip(fdi, schema);

                const label = schema.toothLabels.find(l => l.fdiNumber === fdi);
                if (label) {
                    const [r, g, b] = label.color;
                    btn.style.backgroundColor = `rgb(${r},${g},${b})`;
                    btn.style.color = this._contrastColor(r, g, b);
                    btn.addEventListener('click', () => {
                        this.plugin.setCurrentLabel(label.id);
                        this._updateCurrentLabelDisplay();
                        this._updateLabelListSelection();
                    });
                }

                td.appendChild(btn);
                row.appendChild(td);
            }
            tbody.appendChild(row);
        }
        table.appendChild(tbody);
        div.appendChild(table);

        // Non-tooth labels
        const extraDiv = document.createElement('div');
        extraDiv.className = 'dental-extra-labels';
        const extras = schema.allLabels.filter(l => l.category !== 'tooth' && l.id !== 0);
        for (const lbl of extras) {
            const btn = document.createElement('button');
            btn.className = 'dental-extra-btn';
            btn.textContent = lbl.name;
            const [r, g, b] = lbl.color;
            btn.style.backgroundColor = `rgb(${r},${g},${b})`;
            btn.style.color = this._contrastColor(r, g, b);
            btn.addEventListener('click', () => {
                this.plugin.setCurrentLabel(lbl.id);
                this._updateCurrentLabelDisplay();
                this._updateLabelListSelection();
            });
            extraDiv.appendChild(btn);
        }
        div.appendChild(extraDiv);

        return div;
    }

    _getFDITooltip(fdi, schema) {
        const label = schema.toothLabels.find(l => l.fdiNumber === fdi);
        return label ? label.name : `Tooth ${fdi}`;
    }

    _contrastColor(r, g, b) {
        const lum = (0.299 * r + 0.587 * g + 0.114 * b);
        return lum > 128 ? '#000' : '#fff';
    }

    // --- Label List ---

    _buildLabelList() {
        const div = document.createElement('div');
        div.className = 'dental-label-list';

        const filterDiv = document.createElement('div');
        filterDiv.className = 'dental-label-filter';
        const categories = ['All', 'Teeth', 'Gingiva', 'Anatomy', 'Pathology'];
        this._categoryFilter = 'All';
        for (const cat of categories) {
            const btn = document.createElement('button');
            btn.className = 'dental-filter-btn';
            btn.textContent = cat;
            if (cat === 'All') btn.classList.add('active');
            btn.addEventListener('click', () => {
                this._categoryFilter = cat;
                filterDiv.querySelectorAll('.dental-filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this._filterLabelList();
            });
            filterDiv.appendChild(btn);
        }
        div.appendChild(filterDiv);

        this._labelListContainer = document.createElement('div');
        this._labelListContainer.className = 'dental-label-scroll';
        this._populateLabelList();
        div.appendChild(this._labelListContainer);

        return div;
    }

    _populateLabelList() {
        const container = this._labelListContainer;
        container.innerHTML = '';

        const schema = this.plugin.schema;
        this._labelItems = {};

        for (const lbl of schema.allLabels) {
            if (lbl.id === 0) continue;

            const item = document.createElement('div');
            item.className = 'dental-label-item';
            item.dataset.category = lbl.category;
            item.dataset.labelId = lbl.id;

            const swatch = document.createElement('span');
            swatch.className = 'dental-label-swatch';
            const [r, g, b] = lbl.color;
            swatch.style.backgroundColor = `rgb(${r},${g},${b})`;

            const name = document.createElement('span');
            name.className = 'dental-label-text';
            name.textContent = lbl.name;

            item.appendChild(swatch);
            item.appendChild(name);
            item.addEventListener('click', () => {
                this.plugin.setCurrentLabel(lbl.id);
                this._updateCurrentLabelDisplay();
                this._updateLabelListSelection();
            });

            container.appendChild(item);
            this._labelItems[lbl.id] = item;
        }

        this._updateLabelListSelection();
    }

    _updateLabelListSelection() {
        const currentId = this.plugin.currentLabel;
        for (const [id, item] of Object.entries(this._labelItems)) {
            item.classList.toggle('selected', parseInt(id) === currentId);
        }
    }

    _filterLabelList() {
        const cat = this._categoryFilter;
        const categoryMap = {
            'All': null, 'Teeth': 'tooth', 'Gingiva': 'gingiva',
            'Anatomy': 'anatomy', 'Pathology': 'pathology'
        };
        const filter = categoryMap[cat];

        for (const item of this._labelListContainer.children) {
            if (!filter || item.dataset.category === filter) {
                item.style.display = '';
            } else {
                item.style.display = 'none';
            }
        }
    }

    // --- Camera Panel ---

    _buildCameraPanel() {
        const div = document.createElement('div');
        div.className = 'dental-camera';

        // View presets
        const presetLabel = document.createElement('div');
        presetLabel.className = 'dental-camera-label';
        presetLabel.textContent = 'View Presets';
        div.appendChild(presetLabel);

        const presetGrid = document.createElement('div');
        presetGrid.className = 'dental-camera-grid';

        const views = [
            { id: 'front',    label: 'Front',    key: '1' },
            { id: 'back',     label: 'Back',     key: '2' },
            { id: 'left',     label: 'Left',     key: '3' },
            { id: 'right',    label: 'Right',    key: '4' },
            { id: 'top',      label: 'Top',      key: '5' },
            { id: 'bottom',   label: 'Bottom',   key: '6' },
            { id: 'occlusal', label: 'Occlusal', key: '7' },
        ];

        for (const v of views) {
            const btn = document.createElement('button');
            btn.className = 'dental-camera-btn';
            btn.textContent = v.label;
            btn.title = `${v.label} view (Numpad ${v.key})`;
            btn.addEventListener('click', () => {
                this.editor.setCameraView(v.id);
            });
            presetGrid.appendChild(btn);
        }
        div.appendChild(presetGrid);

        // FOV slider
        const fovDiv = document.createElement('div');
        fovDiv.className = 'dental-camera-fov';

        const fovLabel = document.createElement('label');
        fovLabel.textContent = 'FOV: ';
        this._fovValue = document.createElement('span');
        this._fovValue.textContent = '50';
        fovLabel.appendChild(this._fovValue);

        const fovSlider = document.createElement('input');
        fovSlider.type = 'range';
        fovSlider.min = '10';
        fovSlider.max = '120';
        fovSlider.value = '50';
        fovSlider.className = 'dental-slider';
        fovSlider.addEventListener('input', (e) => {
            const fov = parseInt(e.target.value);
            this._fovValue.textContent = fov;
            this.editor.setCameraFOV(fov);
        });

        fovDiv.appendChild(fovLabel);
        fovDiv.appendChild(fovSlider);
        div.appendChild(fovDiv);

        // --- Lighting controls ---
        const lightLabel = document.createElement('div');
        lightLabel.className = 'dental-camera-label';
        lightLabel.textContent = 'Lighting';
        lightLabel.style.marginTop = '10px';
        div.appendChild(lightLabel);

        // Camera headlight toggle
        const headlightRow = document.createElement('label');
        headlightRow.className = 'dental-checkbox-label';
        const headlightCb = document.createElement('input');
        headlightCb.type = 'checkbox';
        headlightCb.checked = true;
        headlightCb.addEventListener('change', (e) => {
            this.editor.setHeadLight(e.target.checked);
        });
        headlightRow.appendChild(headlightCb);
        headlightRow.appendChild(document.createTextNode(' Camera Light'));
        div.appendChild(headlightRow);

        // Headlight intensity
        const hlIntDiv = document.createElement('div');
        hlIntDiv.style.marginTop = '4px';
        const hlIntLabel = document.createElement('label');
        hlIntLabel.textContent = 'Light Intensity: ';
        const hlIntVal = document.createElement('span');
        hlIntVal.textContent = '1.0';
        hlIntLabel.appendChild(hlIntVal);
        const hlIntSlider = document.createElement('input');
        hlIntSlider.type = 'range';
        hlIntSlider.min = '0';
        hlIntSlider.max = '3';
        hlIntSlider.step = '0.1';
        hlIntSlider.value = '1.0';
        hlIntSlider.className = 'dental-slider';
        hlIntSlider.addEventListener('input', (e) => {
            const v = parseFloat(e.target.value);
            hlIntVal.textContent = v.toFixed(1);
            this.editor.setHeadLightIntensity(v);
        });
        hlIntDiv.appendChild(hlIntLabel);
        hlIntDiv.appendChild(hlIntSlider);
        div.appendChild(hlIntDiv);

        // Ambient intensity
        const ambDiv = document.createElement('div');
        ambDiv.style.marginTop = '4px';
        const ambLabel = document.createElement('label');
        ambLabel.textContent = 'Ambient: ';
        const ambVal = document.createElement('span');
        ambVal.textContent = '0.3';
        ambLabel.appendChild(ambVal);
        const ambSlider = document.createElement('input');
        ambSlider.type = 'range';
        ambSlider.min = '0';
        ambSlider.max = '2';
        ambSlider.step = '0.05';
        ambSlider.value = '0.3';
        ambSlider.className = 'dental-slider';
        ambSlider.addEventListener('input', (e) => {
            const v = parseFloat(e.target.value);
            ambVal.textContent = v.toFixed(2);
            this.editor.setAmbientIntensity(v);
        });
        ambDiv.appendChild(ambLabel);
        ambDiv.appendChild(ambSlider);
        div.appendChild(ambDiv);

        // Screenshot button
        const screenshotBtn = document.createElement('button');
        screenshotBtn.className = 'dental-export-btn';
        screenshotBtn.textContent = 'Screenshot (PNG)';
        screenshotBtn.style.marginTop = '10px';
        screenshotBtn.addEventListener('click', () => {
            this.editor.downloadScreenshot();
        });
        div.appendChild(screenshotBtn);

        return div;
    }

    // --- Export ---

    _buildExportButtons() {
        const div = document.createElement('div');
        div.className = 'dental-export';

        const btnPLY = document.createElement('button');
        btnPLY.className = 'dental-export-btn';
        btnPLY.textContent = 'Export Labeled PLY';
        btnPLY.addEventListener('click', () => this._exportPLY());

        const btnJSON = document.createElement('button');
        btnJSON.className = 'dental-export-btn';
        btnJSON.textContent = 'Export JSON Sidecar';
        btnJSON.addEventListener('click', () => this._exportJSON());

        const btnBoth = document.createElement('button');
        btnBoth.className = 'dental-export-btn primary';
        btnBoth.textContent = 'Export PLY + JSON';
        btnBoth.addEventListener('click', () => this._exportBoth());

        div.appendChild(btnBoth);
        div.appendChild(btnPLY);
        div.appendChild(btnJSON);
        return div;
    }

    _exportPLY() {
        const mesh = this.plugin.activeMesh;
        if (!mesh) { alert('No mesh selected'); return; }
        const exporter = new DentalExporter(this.plugin.vlm, this.plugin.schema);
        const blob = exporter.exportPLYBinary(mesh);
        const name = (mesh.name || 'mesh') + '_labeled.ply';
        DentalExporter.download(blob, name);
    }

    _exportJSON() {
        const mesh = this.plugin.activeMesh;
        if (!mesh) { alert('No mesh selected'); return; }
        const exporter = new DentalExporter(this.plugin.vlm, this.plugin.schema);
        const blob = exporter.exportJSON(mesh);
        const name = (mesh.name || 'mesh') + '_labels.json';
        DentalExporter.download(blob, name);
    }

    _exportBoth() {
        this._exportPLY();
        setTimeout(() => this._exportJSON(), 500);
    }

    // --- Signal bindings ---

    _bindSignals() {
        if (this.editor.signals.brushRadiusChanged) {
            this.editor.signals.brushRadiusChanged.add((radius) => {
                this._radiusSlider.value = radius;
                this._radiusValue.textContent = radius.toFixed(1);
            });
        }

        if (this.editor.signals.labelChanged) {
            this.editor.signals.labelChanged.add(() => {
                this._updateCurrentLabelDisplay();
                this._updateLabelListSelection();
            });
        }
    }

    getElement() {
        return this.container;
    }
}

export { SidebarDental };

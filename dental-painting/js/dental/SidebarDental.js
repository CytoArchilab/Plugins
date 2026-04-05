/**
 * SidebarDental.js — Sidebar panel: tool buttons, label selector, FDI grid, camera.
 *
 * Copyright (c) CytoArchiLab. All rights reserved.
 */

import { DentalExporter } from './DentalExporter.js';
import { ANNOTATION_COLORS, MARKER_ICONS } from './TextAnnotationManager.js';
import { EditAnnotationCommand } from './TextCommands.js';

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
        this._addSection('Color Mode', this._buildColorModeToggle());
        this._addSection('Brush Settings', this._buildBrushSettings());
        this._addSection('Text Settings', this._buildTextSettings());
        this._addSection('Annotations', this._buildAnnotationList());
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
            { id: 'fill', label: 'Fill', shortcut: 'F' },
            { id: 'text', label: 'Text', shortcut: 'T' }
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
        hint.textContent = 'Left-click: paint/annotate | Right-drag: rotate | Scroll: brush size | Cmd/Ctrl+scroll: zoom';
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

    // --- Color Mode ---

    _buildColorModeToggle() {
        const div = document.createElement('div');
        div.className = 'dental-color-mode';

        const btnRow = document.createElement('div');
        btnRow.className = 'ann-btn-row';

        const origBtn = document.createElement('button');
        origBtn.className = 'dental-export-btn ann-confirm-btn active';
        origBtn.textContent = 'Original Color';
        origBtn.addEventListener('click', () => {
            this._setColorMode('original');
            origBtn.classList.add('active');
            labelBtn.classList.remove('active');
        });
        btnRow.appendChild(origBtn);

        const labelBtn = document.createElement('button');
        labelBtn.className = 'dental-export-btn ann-confirm-btn';
        labelBtn.textContent = 'Label Color';
        labelBtn.addEventListener('click', () => {
            this._setColorMode('label');
            labelBtn.classList.add('active');
            origBtn.classList.remove('active');
        });
        btnRow.appendChild(labelBtn);

        div.appendChild(btnRow);
        return div;
    }

    _setColorMode(mode) {
        this.plugin.vlm.colorMode = mode;
        // Re-sync colors for active mesh
        if (this.plugin.activeMesh) {
            this.plugin.vlm.syncColors(this.plugin.activeMesh, this.plugin.schema);
        }
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

    // --- Text Annotation Settings ---

    _buildTextSettings() {
        const div = document.createElement('div');
        div.className = 'dental-text-settings';

        // Show/Hide toggle
        const visRow = document.createElement('label');
        visRow.className = 'dental-checkbox-label';
        const visCb = document.createElement('input');
        visCb.type = 'checkbox';
        visCb.checked = true;
        visCb.addEventListener('change', (e) => {
            this.plugin.annManager.setVisible(e.target.checked);
        });
        // Color palette
        const colorLabel = document.createElement('div');
        colorLabel.className = 'dental-camera-label';
        colorLabel.textContent = 'Annotation Color';
        div.appendChild(colorLabel);

        const colorGrid = document.createElement('div');
        colorGrid.className = 'ann-color-grid';
        this._colorButtons = {};
        for (const color of ANNOTATION_COLORS) {
            const btn = document.createElement('button');
            btn.className = 'ann-color-btn';
            btn.style.backgroundColor = color;
            if (color === this.plugin.annManager.currentColor) btn.classList.add('active');
            btn.addEventListener('click', () => {
                const am = this.plugin.annManager;
                am.currentColor = color;
                Object.values(this._colorButtons).forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                // Update selected annotation if any
                if (am.selectedId !== null) {
                    am.updateColor(am.selectedId, color);
                }
            });
            colorGrid.appendChild(btn);
            this._colorButtons[color] = btn;
        }
        div.appendChild(colorGrid);

        // Marker icon selector
        const markerLabel = document.createElement('div');
        markerLabel.className = 'dental-camera-label';
        markerLabel.textContent = 'Marker Icon';
        markerLabel.style.marginTop = '8px';
        div.appendChild(markerLabel);

        const markerGrid = document.createElement('div');
        markerGrid.className = 'ann-marker-grid';
        this._markerButtons = {};
        for (const [key, iconDef] of Object.entries(MARKER_ICONS)) {
            const btn = document.createElement('button');
            btn.className = 'ann-marker-btn';
            btn.title = key;
            if (key === this.plugin.annManager.currentMarker) btn.classList.add('active');
            btn.innerHTML = `<svg viewBox="${iconDef.vb}" width="18" height="18"><path d="${iconDef.path}" fill="currentColor"/></svg>`;
            btn.addEventListener('click', () => {
                const am = this.plugin.annManager;
                am.currentMarker = key;
                Object.values(this._markerButtons).forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                // Update selected annotation if any
                if (am.selectedId !== null) {
                    am.updateMarker(am.selectedId, key);
                }
            });
            markerGrid.appendChild(btn);
            this._markerButtons[key] = btn;
        }
        div.appendChild(markerGrid);

        // Text input area
        const inputLabel = document.createElement('div');
        inputLabel.className = 'dental-camera-label';
        inputLabel.textContent = 'Annotation Text';
        inputLabel.style.marginTop = '8px';
        div.appendChild(inputLabel);

        this._annTextInput = document.createElement('input');
        this._annTextInput.type = 'text';
        this._annTextInput.className = 'ann-text-input';
        this._annTextInput.placeholder = 'Click on model, then type here...';
        div.appendChild(this._annTextInput);

        const btnRow = document.createElement('div');
        btnRow.className = 'ann-btn-row';

        this._annAddBtn = document.createElement('button');
        this._annAddBtn.className = 'dental-export-btn ann-confirm-btn';
        this._annAddBtn.textContent = 'Add';
        this._annAddBtn.addEventListener('click', () => this._confirmAnnotation());
        btnRow.appendChild(this._annAddBtn);

        this._annUpdateBtn = document.createElement('button');
        this._annUpdateBtn.className = 'dental-export-btn ann-confirm-btn';
        this._annUpdateBtn.textContent = 'Update';
        this._annUpdateBtn.style.display = 'none';
        this._annUpdateBtn.addEventListener('click', () => this._confirmEdit());
        btnRow.appendChild(this._annUpdateBtn);

        div.appendChild(btnRow);

        // Enter key to confirm
        this._annTextInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                if (this._editingAnnId !== null) {
                    this._confirmEdit();
                } else {
                    this._confirmAnnotation();
                }
            }
        });

        // Selection status
        this._annSelectionInfo = document.createElement('div');
        this._annSelectionInfo.className = 'ann-selection-info';
        this._annSelectionInfo.textContent = 'Click on model to place annotation';
        div.appendChild(this._annSelectionInfo);

        this._editingAnnId = null;

        return div;
    }

    _confirmAnnotation() {
        const text = this._annTextInput.value.trim();
        if (!text) return;
        this.plugin.textTool.confirmText(text);
        this._annTextInput.value = '';
        this._annSelectionInfo.textContent = 'Annotation added. Click model to place another.';
        this._refreshAnnotationList();
    }

    _confirmEdit() {
        const text = this._annTextInput.value.trim();
        if (!text || this._editingAnnId === null) return;
        const cmd = new EditAnnotationCommand(this.editor, this.plugin.annManager, this._editingAnnId, text);
        cmd.execute();
        this.editor.history.push(cmd);
        this._exitEditMode();
    }

    _enterEditMode(annId, currentText) {
        this._editingAnnId = annId;
        this._annTextInput.value = currentText;
        this._annTextInput.focus();
        this._annTextInput.select();
        this._annAddBtn.style.display = 'none';
        this._annUpdateBtn.style.display = '';
        this._annSelectionInfo.textContent = `Editing annotation — press Enter or click Update`;
    }

    _exitEditMode() {
        this._editingAnnId = null;
        this._annTextInput.value = '';
        this._annAddBtn.style.display = '';
        this._annUpdateBtn.style.display = 'none';
        this._annSelectionInfo.textContent = 'Click on model to place annotation';
    }


    // --- Annotation List ---

    _buildAnnotationList() {
        const div = document.createElement('div');
        div.className = 'dental-ann-list';

        // Show All / Hide All buttons
        const btnRow = document.createElement('div');
        btnRow.className = 'ann-btn-row';

        const showAllBtn = document.createElement('button');
        showAllBtn.className = 'dental-export-btn ann-confirm-btn';
        showAllBtn.textContent = 'Show All';
        showAllBtn.addEventListener('click', () => {
            this.plugin.annManager.setAllVisible(true);
            this._refreshAnnotationList();
        });
        btnRow.appendChild(showAllBtn);

        const hideAllBtn = document.createElement('button');
        hideAllBtn.className = 'dental-export-btn ann-confirm-btn';
        hideAllBtn.textContent = 'Hide All';
        hideAllBtn.addEventListener('click', () => {
            this.plugin.annManager.setAllVisible(false);
            this._refreshAnnotationList();
        });
        btnRow.appendChild(hideAllBtn);

        const deleteAllBtn = document.createElement('button');
        deleteAllBtn.className = 'dental-export-btn ann-confirm-btn ann-delete-all';
        deleteAllBtn.textContent = 'Delete All';
        deleteAllBtn.addEventListener('click', () => {
            const am = this.plugin.annManager;
            const ids = am.getAll().map(a => a.id);
            if (ids.length === 0) return;
            for (const id of ids) {
                this.editor.signals.annotationRemoveRequested.dispatch(id);
            }
        });
        btnRow.appendChild(deleteAllBtn);

        div.appendChild(btnRow);

        // Scrollable list container
        this._annListContainer = document.createElement('div');
        this._annListContainer.className = 'ann-list-scroll';
        div.appendChild(this._annListContainer);

        return div;
    }

    _refreshAnnotationList() {
        const container = this._annListContainer;
        if (!container) return;
        container.innerHTML = '';

        const am = this.plugin.annManager;
        const annotations = am.getAll();

        if (annotations.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'ann-list-empty';
            empty.textContent = 'No annotations yet';
            container.appendChild(empty);
            return;
        }

        for (const ann of annotations) {
            const item = document.createElement('div');
            item.className = 'ann-list-item';
            if (am.selectedId === ann.id) item.classList.add('selected');
            if (ann.hidden) item.classList.add('hidden');

            const dot = document.createElement('span');
            dot.className = 'ann-list-dot';
            dot.style.backgroundColor = ann.color;
            item.appendChild(dot);

            const text = document.createElement('span');
            text.className = 'ann-list-text';
            text.textContent = ann.text;
            item.appendChild(text);

            const toggleBtn = document.createElement('button');
            toggleBtn.className = 'ann-list-btn';
            toggleBtn.title = ann.hidden ? 'Show' : 'Hide';
            toggleBtn.textContent = ann.hidden ? '◻' : '◼';
            toggleBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                am.setAnnotationVisible(ann.id, !!ann.hidden);
                this._refreshAnnotationList();
            });
            item.appendChild(toggleBtn);

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'ann-list-btn ann-list-del';
            deleteBtn.title = 'Delete';
            deleteBtn.textContent = '×';
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.editor.signals.annotationRemoveRequested.dispatch(ann.id);
                this._refreshAnnotationList();
            });
            item.appendChild(deleteBtn);

            // Click row to select
            item.addEventListener('click', () => {
                am.select(ann.id);
                this._refreshAnnotationList();
            });

            container.appendChild(item);
        }
    }

    _updateAnnotationSelection(annId) {
        const am = this.plugin.annManager;
        if (annId === null) {
            this._annSelectionInfo.textContent = 'Click an annotation to select and edit';
            return;
        }
        const ann = am.get(annId);
        if (!ann) return;
        this._annSelectionInfo.textContent = `Selected: "${ann.text}"`;
        // Sync sidebar color/marker buttons to match selected annotation
        Object.values(this._colorButtons).forEach(b => b.classList.remove('active'));
        if (this._colorButtons[ann.color]) this._colorButtons[ann.color].classList.add('active');
        am.currentColor = ann.color;

        Object.values(this._markerButtons).forEach(b => b.classList.remove('active'));
        if (this._markerButtons[ann.marker]) this._markerButtons[ann.marker].classList.add('active');
        am.currentMarker = ann.marker;
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
        const exporter = new DentalExporter(this.plugin.vlm, this.plugin.schema, this.plugin.annManager);
        const blob = exporter.exportPLYBinary(mesh);
        const name = (mesh.name || 'mesh') + '_labeled.ply';
        DentalExporter.download(blob, name);
    }

    _exportJSON() {
        const mesh = this.plugin.activeMesh;
        if (!mesh) { alert('No mesh selected'); return; }
        const exporter = new DentalExporter(this.plugin.vlm, this.plugin.schema, this.plugin.annManager);
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

        if (this.editor.signals.annotationSelected) {
            this.editor.signals.annotationSelected.add((annId) => {
                this._updateAnnotationSelection(annId);
                this._refreshAnnotationList();
            });
        }

        if (this.editor.signals.annotationChanged) {
            this.editor.signals.annotationChanged.add(() => {
                this._refreshAnnotationList();
            });
        }

        if (this.editor.signals.textHitPending) {
            this.editor.signals.textHitPending.add(() => {
                this._annTextInput.focus();
                this._annSelectionInfo.textContent = 'Point placed — type text and press Enter or click Add';
            });
        }

        if (this.editor.signals.textEditPending) {
            this.editor.signals.textEditPending.add((annId, currentText) => {
                this._enterEditMode(annId, currentText);
            });
        }
    }

    getElement() {
        return this.container;
    }
}

export { SidebarDental };

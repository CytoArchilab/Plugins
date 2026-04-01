/**
 * DentalPlugin.js — Plugin entry point.
 * Registers all dental annotation capabilities into the Three.js editor.
 *
 * Copyright (c) CytoArchiLab. All rights reserved.
 */

import { LabelSchema, createDefaultSchema } from './LabelSchema.js';
import { VertexLabelManager } from './VertexLabelManager.js';
import { BrushTool } from './BrushTool.js';
import { EraserTool } from './EraserTool.js';
import { FloodFillTool } from './FloodFillTool.js';
import { SidebarDental } from './SidebarDental.js';
import * as THREE from 'three';

class DentalPlugin {
    /**
     * Initialize the dental annotation plugin.
     * @param {object} editor - Three.js editor instance
     */
    static init(editor) {
        return new DentalPlugin(editor);
    }

    constructor(editor) {
        this.editor = editor;

        // Add custom signals
        this._registerSignals();

        // Create label schema (default FDI)
        this.schema = createDefaultSchema();

        // Create vertex label manager
        this.vlm = new VertexLabelManager();

        // Current state
        this.currentLabel = 1;
        this.activeMesh = null;
        this._activeToolName = 'brush';

        // Create tools
        this.brushTool = new BrushTool(editor, this.vlm, this.schema);
        this.eraserTool = new EraserTool(editor, this.vlm, this.schema);
        this.fillTool = new FloodFillTool(editor, this.vlm, this.schema);

        this._tools = {
            brush: this.brushTool,
            eraser: this.eraserTool,
            fill: this.fillTool
        };

        // Create sidebar panel
        this.sidebar = new SidebarDental(editor, this);

        // Hook into editor signals
        this._hookSignals();

        // Register sidebar tab
        this._registerSidebar();

        // Set up keyboard shortcuts
        this._setupShortcuts();

        // Initialize any existing meshes
        editor.scene.traverse((obj) => {
            if (obj.isMesh) {
                this._initializeMesh(obj);
            }
        });

        console.log('[DentalPlugin] Initialized with', this.schema.size, 'labels');
    }

    _registerSignals() {
        const signals = this.editor.signals;
        // Add dental-specific signals
        if (!signals.vertexPainted) {
            signals.vertexPainted = new signals._Signal();
        }
        if (!signals.labelChanged) {
            signals.labelChanged = new signals._Signal();
        }
        if (!signals.brushRadiusChanged) {
            signals.brushRadiusChanged = new signals._Signal();
        }
    }

    _hookSignals() {
        const signals = this.editor.signals;

        // When a new object is added to the scene
        signals.objectAdded.add((object) => {
            if (object.isMesh) {
                this._initializeMesh(object);
            }
            // Also check children
            object.traverse((child) => {
                if (child !== object && child.isMesh) {
                    this._initializeMesh(child);
                }
            });
        });

        // When an object is selected
        signals.objectSelected.add((object) => {
            if (object && object.isMesh) {
                this._setActiveMesh(object);
            } else if (object) {
                // Check if any child is a mesh
                let foundMesh = null;
                object.traverse((child) => {
                    if (child.isMesh && !foundMesh) {
                        foundMesh = child;
                    }
                });
                if (foundMesh) {
                    this._setActiveMesh(foundMesh);
                }
            }
        });

        // When an object is removed
        signals.objectRemoved.add((object) => {
            if (object.isMesh) {
                this.vlm.removeMesh(object.uuid);
                if (this.activeMesh === object) {
                    this.activeMesh = null;
                    this._deactivateAllTools();
                }
            }
        });
    }

    _initializeMesh(mesh) {
        if (!mesh.geometry || !mesh.geometry.attributes.position) return;

        // Skip if already initialized
        if (this.vlm.getLabelsArray(mesh.uuid)) return;

        console.log('[DentalPlugin] Initializing mesh:', mesh.name || mesh.uuid);

        // Ensure geometry has computed normals
        if (!mesh.geometry.attributes.normal) {
            mesh.geometry.computeVertexNormals();
        }

        // Ensure indexed geometry for adjacency
        if (!mesh.geometry.index) {
            // Non-indexed geometry — we can still work with it but adjacency is limited
            console.warn('[DentalPlugin] Mesh has non-indexed geometry. Adjacency will be limited.');
        }

        // Replace material for vertex color support
        mesh.material = new THREE.MeshPhongMaterial({
            vertexColors: true,
            side: THREE.DoubleSide,
            flatShading: false
        });

        this.vlm.initMesh(mesh);
        this.vlm.syncColors(mesh, this.schema);

        // Auto-select if no active mesh
        if (!this.activeMesh) {
            this._setActiveMesh(mesh);
        }
    }

    _setActiveMesh(mesh) {
        this.activeMesh = mesh;
        this.brushTool.setActiveMesh(mesh);
        this.eraserTool.setActiveMesh(mesh);
        this.fillTool.setActiveMesh(mesh);
    }

    _registerSidebar() {
        const sidebarEl = this.sidebar.getElement();
        const tabContainer = document.getElementById('dental-tab');
        if (tabContainer) {
            tabContainer.appendChild(sidebarEl);
        }
    }

    // --- Public API ---

    setActiveTool(toolName) {
        this._deactivateAllTools();
        this._activeToolName = toolName;

        // Tools register on the canvas (renderer.domElement), not the viewport div
        const canvas = this.editor.canvas;
        if (!canvas) return;

        const tool = this._tools[toolName];
        if (tool) {
            tool.activate(canvas);
        }
    }

    setCurrentLabel(labelId) {
        this.currentLabel = labelId;
        this.brushTool.currentLabel = labelId;
        this.fillTool.currentLabel = labelId;
        if (this.editor.signals.labelChanged) {
            this.editor.signals.labelChanged.dispatch(labelId);
        }
    }

    setBrushRadius(radius) {
        this.brushTool.brushRadius = radius;
        this.eraserTool.brushRadius = radius;
        if (this.editor.signals.brushRadiusChanged) {
            this.editor.signals.brushRadiusChanged.dispatch(radius);
        }
    }

    _deactivateAllTools() {
        this.brushTool.deactivate();
        this.eraserTool.deactivate();
        this.fillTool.deactivate();
    }

    _setupShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            switch (e.key.toUpperCase()) {
                case 'B':
                    this.sidebar._selectTool('brush');
                    break;
                case 'E':
                    this.sidebar._selectTool('eraser');
                    break;
                case 'F':
                    this.sidebar._selectTool('fill');
                    break;
                case '[':
                    this.setBrushRadius(Math.max(0.1, this.brushTool.brushRadius - 0.5));
                    break;
                case ']':
                    this.setBrushRadius(Math.min(50, this.brushTool.brushRadius + 0.5));
                    break;
            }

            // Numpad camera presets
            const viewMap = {
                '1': 'front', '2': 'back', '3': 'left', '4': 'right',
                '5': 'top', '6': 'bottom', '7': 'occlusal'
            };
            if (viewMap[e.key]) {
                this.editor.setCameraView(viewMap[e.key]);
            }
        });
    }
}

export { DentalPlugin };

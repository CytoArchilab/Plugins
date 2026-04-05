/**
 * Editor.js — Three.js editor shell for the Dental Annotation Plugin.
 *
 * Copyright (c) CytoArchiLab. All rights reserved.
 *
 * Controls:
 *   Left-click drag       = annotation tool (brush/eraser/fill)
 *   Right-click drag      = orbit (rotate view)
 *   Middle-click drag     = pan
 *   Scroll                = brush radius
 *   Cmd/Ctrl + scroll     = zoom in/out
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PLYLoader } from 'three/addons/loaders/PLYLoader.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';

class Signal {
    constructor() { this._listeners = []; }
    add(fn) { this._listeners.push(fn); }
    remove(fn) { this._listeners = this._listeners.filter(l => l !== fn); }
    dispatch(...args) { for (const fn of this._listeners) fn(...args); }
}

class History {
    constructor() {
        this._undoStack = [];
        this._redoStack = [];
        this.maxHistory = 200;
    }
    push(cmd) {
        this._undoStack.push(cmd);
        if (this._undoStack.length > this.maxHistory) this._undoStack.shift();
        this._redoStack.length = 0;
    }
    execute(cmd) { cmd.execute(); this.push(cmd); }
    undo() {
        if (!this._undoStack.length) return;
        const cmd = this._undoStack.pop(); cmd.undo(); this._redoStack.push(cmd);
    }
    redo() {
        if (!this._redoStack.length) return;
        const cmd = this._redoStack.pop(); cmd.execute(); this._undoStack.push(cmd);
    }
    get canUndo() { return this._undoStack.length > 0; }
    get canRedo() { return this._redoStack.length > 0; }
}

class Editor {
    constructor() {
        this.signals = {
            _Signal: Signal,
            objectAdded: new Signal(),
            objectSelected: new Signal(),
            objectRemoved: new Signal(),
            sceneGraphChanged: new Signal(),
            rendererUpdated: new Signal(),
            cameraChanged: new Signal(),
        };

        this.history = new History();

        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x2a2a2a);
        this.sceneHelpers = new THREE.Scene();

        // Camera
        this.camera = new THREE.PerspectiveCamera(50, 1, 0.01, 1000);
        this.camera.position.set(0, 50, 100);
        this.camera.lookAt(0, 0, 0);
        this.viewportCamera = this.camera;

        this.renderer = null;
        this.controls = null;
        this.viewportElement = null;
        this.canvas = null;

        // Lighting
        this._ambientLight = null;
        this._headLight = null;      // follows camera
        this._headLightEnabled = true;
        this._fixedLights = [];
        this._setupLighting();

        // Grid
        const grid = new THREE.GridHelper(200, 20, 0x444444, 0x333333);
        this.sceneHelpers.add(grid);

        // File loaders
        this._plyLoader = new PLYLoader();
        this._stlLoader = new STLLoader();
        this._objLoader = new OBJLoader();

        this.selected = null;
        this._sceneCenter = new THREE.Vector3();
        this._sceneSize = 100;

        // Undo/Redo
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
                e.preventDefault(); this.history.undo();
            }
            if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
                e.preventDefault(); this.history.redo();
            }
        });
    }

    initViewport(container) {
        this.viewportElement = container;

        this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        this.renderer.autoClear = false;
        container.appendChild(this.renderer.domElement);
        this.canvas = this.renderer.domElement;

        // OrbitControls: right-drag = orbit, middle-drag = pan
        // Scroll zoom DISABLED — we handle zoom manually via Cmd/Ctrl+scroll
        this.controls = new OrbitControls(this.camera, this.canvas);
        this.controls.mouseButtons = {
            LEFT: null,
            MIDDLE: THREE.MOUSE.PAN,
            RIGHT: THREE.MOUSE.ROTATE
        };
        this.controls.enableZoom = false;   // we handle zoom via wheel ourselves
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.1;

        // Manual zoom: Cmd/Ctrl+scroll = zoom in/out
        // Plain scroll is handled by BrushTool for radius adjustment
        this.canvas.addEventListener('wheel', (e) => {
            if (e.metaKey || e.ctrlKey) {
                e.preventDefault();
                const zoomFactor = e.deltaY > 0 ? 1.1 : 0.9;
                // Dolly: move camera closer/further from target
                const dir = new THREE.Vector3().subVectors(
                    this.camera.position, this.controls.target
                );
                dir.multiplyScalar(zoomFactor);
                this.camera.position.copy(this.controls.target).add(dir);
                this.controls.update();
            }
        }, { passive: false });

        // Resize
        const ro = new ResizeObserver(() => {
            const w = container.clientWidth;
            const h = container.clientHeight;
            this.camera.aspect = w / h;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(w, h);
        });
        ro.observe(container);

        // Animation loop
        const animate = () => {
            requestAnimationFrame(animate);
            this.controls.update();
            // Update headlight to follow camera
            if (this._headLight) {
                this._headLight.position.copy(this.camera.position);
            }
            this.renderer.clear();
            this.renderer.render(this.scene, this.camera);
            this.renderer.render(this.sceneHelpers, this.camera);
        };
        animate();
    }

    _setupLighting() {
        // Ambient: soft fill
        this._ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
        this.scene.add(this._ambientLight);

        // Headlight: point light at camera position — follows the camera
        // This is the primary light, like a "flashlight" mounted on the camera
        this._headLight = new THREE.PointLight(0xffffff, 1.0, 0, 0.1);
        this._headLight.position.copy(this.camera.position);
        this.scene.add(this._headLight);

        // Fixed directional lights for consistent shading from two sides
        const dir1 = new THREE.DirectionalLight(0xffffff, 0.4);
        dir1.position.set(50, 100, 50);
        this.scene.add(dir1);
        this._fixedLights.push(dir1);

        const dir2 = new THREE.DirectionalLight(0xffffff, 0.2);
        dir2.position.set(-50, -50, -50);
        this.scene.add(dir2);
        this._fixedLights.push(dir2);
    }

    /** Toggle the camera headlight on/off. */
    setHeadLight(enabled) {
        this._headLightEnabled = enabled;
        if (this._headLight) {
            this._headLight.visible = enabled;
        }
    }

    /** Get headlight state. */
    get headLightEnabled() {
        return this._headLightEnabled;
    }

    /** Set headlight intensity. */
    setHeadLightIntensity(val) {
        if (this._headLight) this._headLight.intensity = val;
    }

    /** Set ambient intensity. */
    setAmbientIntensity(val) {
        if (this._ambientLight) this._ambientLight.intensity = val;
    }

    addObject(object) {
        this.scene.add(object);
        this.signals.objectAdded.dispatch(object);
        this.signals.sceneGraphChanged.dispatch();
    }

    removeObject(object) {
        this.scene.remove(object);
        this.signals.objectRemoved.dispatch(object);
        if (this.selected === object) this.selected = null;
        this.signals.sceneGraphChanged.dispatch();
    }

    select(object) {
        this.selected = object;
        this.signals.objectSelected.dispatch(object);
    }

    importFile(file) {
        const ext = file.name.split('.').pop().toLowerCase();
        const reader = new FileReader();

        reader.onload = (e) => {
            const data = e.target.result;
            let geometry = null;

            try {
                switch (ext) {
                    case 'ply':
                        geometry = this._plyLoader.parse(data);
                        break;
                    case 'stl':
                        geometry = this._stlLoader.parse(data);
                        break;
                    case 'obj': {
                        const text = new TextDecoder().decode(data);
                        const group = this._objLoader.parse(text);
                        group.name = file.name;
                        this._centerObject(group);
                        this.addObject(group);
                        this.select(group);
                        this._fitCamera(group);
                        return;
                    }
                    default:
                        alert('Unsupported format: ' + ext);
                        return;
                }

                if (geometry) {
                    geometry.computeVertexNormals();
                    const material = new THREE.MeshPhongMaterial({
                        color: 0x808080,
                        side: THREE.DoubleSide
                    });
                    const mesh = new THREE.Mesh(geometry, material);
                    mesh.name = file.name;
                    this._centerObject(mesh);
                    this.addObject(mesh);
                    this.select(mesh);
                    this._fitCamera(mesh);
                }
            } catch (err) {
                console.error('Import error:', err);
                alert('Failed to import: ' + err.message);
            }
        };

        reader.readAsArrayBuffer(file);
    }

    _centerObject(object) {
        const box = new THREE.Box3().setFromObject(object);
        const center = box.getCenter(new THREE.Vector3());
        object.position.sub(center);
    }

    _fitCamera(object) {
        const box = new THREE.Box3().setFromObject(object);
        this._sceneSize = box.getSize(new THREE.Vector3()).length();
        this._sceneCenter = box.getCenter(new THREE.Vector3());
        const d = this._sceneSize * 1.2;

        this.camera.position.set(
            this._sceneCenter.x,
            this._sceneCenter.y + d * 0.3,
            this._sceneCenter.z + d
        );
        this.camera.lookAt(this._sceneCenter);
        if (this.controls) {
            this.controls.target.copy(this._sceneCenter);
            this.controls.update();
        }
        this.signals.cameraChanged.dispatch();
    }

    setCameraView(direction) {
        const c = this._sceneCenter;
        const d = this._sceneSize * 1.2;
        const pos = new THREE.Vector3();

        switch (direction) {
            case 'front':    pos.set(c.x, c.y, c.z + d); break;
            case 'back':     pos.set(c.x, c.y, c.z - d); break;
            case 'left':     pos.set(c.x - d, c.y, c.z); break;
            case 'right':    pos.set(c.x + d, c.y, c.z); break;
            case 'top':      pos.set(c.x, c.y + d, c.z + 0.001); break;
            case 'bottom':   pos.set(c.x, c.y - d, c.z + 0.001); break;
            case 'occlusal': pos.set(c.x, c.y + d, c.z + d * 0.3); break;
            default: return;
        }

        this.camera.position.copy(pos);
        this.camera.lookAt(c);
        this.camera.up.set(0, 1, 0);
        if (this.controls) {
            this.controls.target.copy(c);
            this.controls.update();
        }
        this.signals.cameraChanged.dispatch();
    }

    setCameraFOV(fov) {
        this.camera.fov = fov;
        this.camera.updateProjectionMatrix();
        this.signals.cameraChanged.dispatch();
    }

    screenshot() {
        this.renderer.clear();
        this.renderer.render(this.scene, this.camera);
        return this.canvas.toDataURL('image/png');
    }

    /**
     * Capture screenshot of viewport including annotation overlays.
     */
    downloadScreenshot(filename = 'dental_screenshot.png') {
        // Force a fresh render right now
        this.renderer.clear();
        this.renderer.render(this.scene, this.camera);

        const cw = this.canvas.width;
        const ch = this.canvas.height;
        const vpW = this.viewportElement.clientWidth;
        const vpH = this.viewportElement.clientHeight;

        const offscreen = document.createElement('canvas');
        offscreen.width = cw;
        offscreen.height = ch;
        const ctx = offscreen.getContext('2d');

        // 1. Draw WebGL canvas (use actual canvas pixel size)
        ctx.drawImage(this.canvas, 0, 0);

        // 2. Scale factor from viewport CSS pixels to canvas pixels
        const rx = cw / vpW;
        const ry = ch / vpH;

        // 3. Draw annotations using Canvas 2D
        if (this._annotationManager) {
            const camera = this.camera;
            const annotations = this._annotationManager.getAll();

            for (const ann of annotations) {
                if (ann.hidden) continue;

                const projected = ann.worldPos.clone().project(camera);
                if (projected.z > 1) continue;

                // Screen position in CSS pixels
                const sx = (projected.x * 0.5 + 0.5) * vpW;
                const sy = (-projected.y * 0.5 + 0.5) * vpH;

                // Convert to canvas pixels
                const cx = sx * rx;
                const cy = sy * ry;

                // Distance-based scale
                const dist = camera.position.distanceTo(ann.worldPos);
                const refDist = this._sceneSize || 100;
                const s = Math.max(0.4, Math.min(1.2, refDist / (dist + refDist * 0.5)));
                const ps = s * rx; // pixel scale

                const color = ann.color || '#e94560';

                // Marker dot
                ctx.save();
                ctx.beginPath();
                ctx.arc(cx, cy, 12 * ps, 0, Math.PI * 2);
                ctx.fillStyle = color;
                ctx.fill();
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 2 * ps;
                ctx.stroke();
                ctx.restore();

                // Text label
                const text = ann.text;
                if (!text) continue;

                const fontSize = Math.round(12 * ps);
                ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;
                const tw = ctx.measureText(text).width;
                const pad = 6 * ps;
                const dotR = 4 * ps;
                const lw = dotR * 2 + 6 * ps + tw + pad * 2;
                const lh = fontSize + pad * 2;
                const lx = cx + 20 * ps;
                const ly = cy - 20 * ps - lh;

                // Background rect (manual rounded rect for compatibility)
                const r = 6 * ps;
                ctx.beginPath();
                ctx.moveTo(lx + r, ly);
                ctx.lineTo(lx + lw - r, ly);
                ctx.quadraticCurveTo(lx + lw, ly, lx + lw, ly + r);
                ctx.lineTo(lx + lw, ly + lh - r);
                ctx.quadraticCurveTo(lx + lw, ly + lh, lx + lw - r, ly + lh);
                ctx.lineTo(lx + r, ly + lh);
                ctx.quadraticCurveTo(lx, ly + lh, lx, ly + lh - r);
                ctx.lineTo(lx, ly + r);
                ctx.quadraticCurveTo(lx, ly, lx + r, ly);
                ctx.closePath();
                ctx.fillStyle = 'rgba(15, 15, 25, 0.92)';
                ctx.fill();
                ctx.strokeStyle = color;
                ctx.lineWidth = 2 * ps;
                ctx.stroke();

                // Color dot in label
                ctx.beginPath();
                ctx.arc(lx + pad + dotR, ly + lh / 2, dotR, 0, Math.PI * 2);
                ctx.fillStyle = color;
                ctx.fill();

                // Text
                ctx.fillStyle = '#fff';
                ctx.textBaseline = 'middle';
                ctx.fillText(text, lx + pad + dotR * 2 + 6 * ps, ly + lh / 2);
            }
        }

        // Download
        const dataUrl = offscreen.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    execute(cmd) {
        this.history.execute(cmd);
    }
}

export { Editor, Signal };

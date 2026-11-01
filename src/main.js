import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ============ AUDIO SYSTEM ============
class AudioEngine {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.masterGain = this.ctx.createGain();
        this.masterGain.connect(this.ctx.destination);
        this.masterGain.gain.value = 0.25;
        this.isPlaying = false;
        this.currentTime = 0;
        this.bpm = 100;
        this.beatInterval = 60 / this.bpm;
        this.nextBeatTime = 0;
        this.onBeatCallbacks = [];
        this.scheduleAheadTime = 0.1;
        this.lookahead = 25;
        this.timerID = null;
        this.beatCount = 0;
    }

    resume() {
        if (this.ctx.state === 'suspended') this.ctx.resume();
    }

    start() {
        if (this.isPlaying) return;
        this.isPlaying = true;
        this.currentTime = this.ctx.currentTime;
        this.nextBeatTime = this.currentTime + 0.1;
        this.scheduler();
    }

    stop() {
        this.isPlaying = false;
        if (this.timerID) clearTimeout(this.timerID);
    }

    scheduler() {
        if (!this.isPlaying) return;
        this.timerID = setTimeout(() => this.scheduler(), this.lookahead);
        
        while (this.nextBeatTime < this.ctx.currentTime + this.scheduleAheadTime) {
            this.scheduleBeat(this.nextBeatTime);
            this.nextBeatTime += this.beatInterval;
        }
    }

    scheduleBeat(time) {
        // Kick drum
        const kick = this.ctx.createOscillator();
        const kickGain = this.ctx.createGain();
        kick.connect(kickGain);
        kickGain.connect(this.masterGain);
        kick.frequency.setValueAtTime(150, time);
        kick.frequency.exponentialRampToValueAtTime(0.01, time + 0.5);
        kickGain.gain.setValueAtTime(1, time);
        kickGain.gain.exponentialRampToValueAtTime(0.01, time + 0.5);
        kick.start(time);
        kick.stop(time + 0.5);

        // Ambient pad (every 4 beats)
        if (this.beatCount % 4 === 0) {
            this.playPad(time);
        }

        // Hi-hat (off-beats)
        if (this.beatCount % 2 === 1) {
            this.playHihat(time);
        }

        // Trigger callbacks
        this.onBeatCallbacks.forEach(cb => cb(time));
        this.currentTime = time;
        this.beatCount++;
    }

    playPad(time) {
        const frequencies = [130.81, 164.81, 196.00, 220.00]; // C3, E3, G3, A3
        frequencies.forEach((freq, i) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            const filter = this.ctx.createBiquadFilter();
            osc.connect(filter);
            filter.connect(gain);
            gain.connect(this.masterGain);
            osc.type = 'sine';
            osc.frequency.value = freq;
            filter.type = 'lowpass';
            filter.frequency.value = 600;
            filter.Q.value = 2;
            gain.gain.setValueAtTime(0, time);
            gain.gain.linearRampToValueAtTime(0.1, time + 0.5);
            gain.gain.exponentialRampToValueAtTime(0.01, time + 4);
            osc.start(time);
            osc.stop(time + 4);
        });
    }

    playHihat(time) {
        const noise = this.ctx.createBufferSource();
        const bufferSize = this.ctx.sampleRate * 0.05;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
        noise.buffer = buffer;
        
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        filter.type = 'highpass';
        filter.frequency.value = 10000;
        gain.gain.setValueAtTime(0.03, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.05);
        noise.start(time);
        noise.stop(time + 0.05);
    }

    onBeat(callback) {
        this.onBeatCallbacks.push(callback);
    }

    getBeatProgress() {
        const elapsed = (this.ctx.currentTime - this.currentTime) % this.beatInterval;
        return elapsed / this.beatInterval;
    }
}

// ============ CRACK SYSTEM ============
class CrackSystem {
    constructor() {
        this.crackCanvases = new Map(); // faceIdx -> canvas
        this.crackTextures = new Map(); // faceIdx -> texture
        this.crackMeshes = new Map();   // faceIdx -> mesh
        this.crackCounts = [0, 0, 0, 0, 0, 0];
        this.maxCracks = 4;
    }

    getCanvas(faceIdx) {
        if (!this.crackCanvases.has(faceIdx)) {
            const canvas = document.createElement('canvas');
            canvas.width = 512;
            canvas.height = 512;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = 'rgba(0,0,0,0)';
            ctx.fillRect(0, 0, 512, 512);
            this.crackCanvases.set(faceIdx, canvas);
            
            const texture = new THREE.CanvasTexture(canvas);
            texture.wrapS = THREE.ClampToEdgeWrapping;
            texture.wrapT = THREE.ClampToEdgeWrapping;
            this.crackTextures.set(faceIdx, texture);
        }
        return this.crackCanvases.get(faceIdx);
    }

    getTexture(faceIdx) {
        this.getCanvas(faceIdx);
        return this.crackTextures.get(faceIdx);
    }

    addCrack(faceIdx, hitPoint, faceNormal, cubeMatrix) {
        const canvas = this.getCanvas(faceIdx);
        const ctx = canvas.getContext('2d');
        
        // Convert 3D hit point to local face UV coordinates (0-1)
        const localPoint = hitPoint.clone().applyMatrix4(cubeMatrix.clone().invert());
        const uv = this.worldToFaceUV(localPoint, faceNormal);
        
        // Draw crack at UV position
        this.drawCrack(ctx, uv.x * 512, uv.y * 512, this.crackCounts[faceIdx]);
        
        this.crackCounts[faceIdx]++;
        this.crackTextures.get(faceIdx).needsUpdate = true;
        
        return this.crackCounts[faceIdx];
    }

    worldToFaceUV(point, normal) {
        // point is in cube local space (-1 to 1)
        // Convert to UV (0 to 1) based on face normal
        let u, v;
        if (Math.abs(normal.z) === 1) { // Front/Back
            u = (point.x + 1) / 2;
            v = (point.y + 1) / 2;
            if (normal.z === -1) u = 1 - u; // Back face UV flip
        } else if (Math.abs(normal.x) === 1) { // Right/Left
            u = (point.z * -normal.x + 1) / 2;
            v = (point.y + 1) / 2;
            if (normal.x === -1) u = 1 - u; // Left face UV flip
        } else { // Top/Bottom
            u = (point.x + 1) / 2;
            v = (point.z * -normal.y + 1) / 2;
            if (normal.y === -1) v = 1 - v; // Bottom face UV flip
        }
        return { x: Math.max(0, Math.min(1, u)), y: Math.max(0, Math.min(1, v)) };
    }

    drawCrack(ctx, cx, cy, crackIndex) {
        // Glass-like progressive cracking.
        // crackIndex 0..3 -> small crack on first hit, full-face shatter on fourth.
        const numRadials = 4 + crackIndex * 2;      // 4, 6, 8, 10
        const baseLength = 50 + crackIndex * 70;    // 50, 120, 190, 260

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.shadowColor = 'rgba(255, 255, 255, 0.7)';
        ctx.shadowBlur = 3;

        // Radial cracks emanating from the impact point
        for (let i = 0; i < numRadials; i++) {
            const angle = (i / numRadials) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
            this.drawRadialCrack(ctx, cx, cy, angle, baseLength, crackIndex);
        }

        // Concentric rings appear from the second hit onward
        if (crackIndex >= 1) {
            const rings = crackIndex; // 1, 2, 3
            for (let r = 0; r < rings; r++) {
                const radius = 25 + r * 35 + crackIndex * 20;
                this.drawCrackRing(ctx, cx, cy, radius, crackIndex);
            }
        }

        // Impact crater at the center
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.beginPath();
        ctx.arc(cx, cy, 3 + crackIndex * 2, 0, Math.PI * 2);
        ctx.fill();
    }

    drawRadialCrack(ctx, cx, cy, angle, length, crackIndex) {
        ctx.lineWidth = 1.5 + crackIndex * 0.6;
        ctx.beginPath();
        ctx.moveTo(cx, cy);

        let x = cx, y = cy;
        let currentAngle = angle;
        const segments = 3 + crackIndex;
        const segLength = length / segments;

        for (let i = 0; i < segments; i++) {
            currentAngle += (Math.random() - 0.5) * 0.5;
            x += Math.cos(currentAngle) * segLength * (0.7 + Math.random() * 0.6);
            y += Math.sin(currentAngle) * segLength * (0.7 + Math.random() * 0.6);
            x = Math.max(5, Math.min(507, x));
            y = Math.max(5, Math.min(507, y));
            ctx.lineTo(x, y);

            // Occasional branch for a more shattered look
            if (Math.random() < 0.35 && i < segments - 1) {
                const branchAngle = currentAngle + (Math.random() - 0.5) * 1.6;
                const branchLen = segLength * (0.4 + Math.random() * 0.5);
                const bx = x + Math.cos(branchAngle) * branchLen;
                const by = y + Math.sin(branchAngle) * branchLen;
                ctx.moveTo(x, y);
                ctx.lineTo(bx, by);
                ctx.moveTo(x, y);
            }
        }
        ctx.stroke();
    }

    drawCrackRing(ctx, cx, cy, radius, crackIndex) {
        ctx.lineWidth = 1 + crackIndex * 0.4;
        ctx.beginPath();
        const segments = 14;
        for (let i = 0; i <= segments; i++) {
            const angle = (i / segments) * Math.PI * 2;
            const r = radius * (0.85 + Math.random() * 0.3);
            const x = cx + Math.cos(angle) * r;
            const y = cy + Math.sin(angle) * r;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();
    }

    createCrackMesh(faceIdx, faceNormal, faceCenter) {
        if (this.crackMeshes.has(faceIdx)) return this.crackMeshes.get(faceIdx);
        
        const geometry = new THREE.PlaneGeometry(2.01, 2.01); // Slightly larger than face
        const material = new THREE.MeshBasicMaterial({
            map: this.getTexture(faceIdx),
            transparent: true,
            opacity: 1,
            depthTest: true,
            depthWrite: false,
            side: THREE.DoubleSide
        });
        const mesh = new THREE.Mesh(geometry, material);
        
        // Position at face center, slightly offset to avoid z-fighting
        mesh.position.copy(faceCenter).addScaledVector(faceNormal, 0.01);
        mesh.lookAt(mesh.position.clone().add(faceNormal));
        mesh.rotateY(Math.PI);
        
        this.crackMeshes.set(faceIdx, mesh);
        return mesh;
    }

    removeCrackMesh(faceIdx) {
        const mesh = this.crackMeshes.get(faceIdx);
        if (mesh) {
            mesh.geometry.dispose();
            mesh.material.map?.dispose();
            mesh.material.dispose();
            this.crackMeshes.delete(faceIdx);
        }
        this.crackCanvases.delete(faceIdx);
        this.crackTextures.delete(faceIdx);
        this.crackCounts[faceIdx] = 0;
    }

    reset() {
        this.crackMeshes.forEach((mesh, idx) => this.removeCrackMesh(idx));
        this.crackCounts = [0, 0, 0, 0, 0, 0];
    }
}

// ============ CUSTOM CUBE GEOMETRY BUILDER ============
function buildCubeGeometry(excludedFaces = new Set()) {
    const faceData = [
        { normal: new THREE.Vector3(0, 0, 1),  uv: [[0,1],[1,1],[1,0],[0,0]] }, // Front  (z+)
        { normal: new THREE.Vector3(0, 0, -1), uv: [[1,1],[0,1],[0,0],[1,0]] }, // Back   (z-)
        { normal: new THREE.Vector3(1, 0, 0),  uv: [[0,1],[1,1],[1,0],[0,0]] }, // Right  (x+)
        { normal: new THREE.Vector3(-1, 0, 0), uv: [[1,1],[0,1],[0,0],[1,0]] }, // Left   (x-)
        { normal: new THREE.Vector3(0, 1, 0),  uv: [[1,0],[1,1],[0,1],[0,0]] }, // Top    (y+)
        { normal: new THREE.Vector3(0, -1, 0), uv: [[0,0],[0,1],[1,1],[1,0]] }, // Bottom (y-)
    ];

    const half = 1;
    const positions = [];
    const normals = [];
    const uvs = [];
    const indices = [];
    let vertexIndex = 0;

    faceData.forEach((face, faceIdx) => {
        if (excludedFaces.has(faceIdx)) return;

        const n = face.normal;
        let corners;
        if (Math.abs(n.z) === 1) {
            // Front (z+) or Back (z-)
            if (n.z === 1) {
                // Front face: CCW from outside (positive Z looking toward origin)
                // x: left(-1) to right(1), y: bottom(-1) to top(1)
                corners = [
                    new THREE.Vector3(-half, -half,  half), // bottom-left
                    new THREE.Vector3( half, -half,  half), // bottom-right
                    new THREE.Vector3( half,  half,  half), // top-right
                    new THREE.Vector3(-half,  half,  half), // top-left
                ];
            } else {
                // Back face (z-): CCW from outside (negative Z looking toward origin)
                // From back: x increases to LEFT, y increases UP
                // Right-bottom (1,-1,-1), Left-bottom (-1,-1,-1), Left-top (-1,1,-1), Right-top (1,1,-1)
                corners = [
                    new THREE.Vector3( half, -half, -half), // right-bottom
                    new THREE.Vector3(-half, -half, -half), // left-bottom
                    new THREE.Vector3(-half,  half, -half), // left-top
                    new THREE.Vector3( half,  half, -half), // right-top
                ];
            }
        } else if (Math.abs(n.x) === 1) {
            // Right (x+) or Left (x-)
            if (n.x === 1) {
                // Right face: CCW from outside (positive X looking toward origin)
                // z: right(1) to left(-1), y: bottom(-1) to top(1)
                corners = [
                    new THREE.Vector3( half, -half,  half), // bottom-right (z+)
                    new THREE.Vector3( half, -half, -half), // bottom-left (z-)
                    new THREE.Vector3( half,  half, -half), // top-left (z-)
                    new THREE.Vector3( half,  half,  half), // top-right (z+)
                ];
            } else {
                // Left face (x-): CCW from outside (negative X looking toward origin)
                // z: left(-1) to right(1), y: bottom(-1) to top(1)
                corners = [
                    new THREE.Vector3(-half, -half, -half), // bottom-left (z-)
                    new THREE.Vector3(-half, -half,  half), // bottom-right (z+)
                    new THREE.Vector3(-half,  half,  half), // top-right (z+)
                    new THREE.Vector3(-half,  half, -half), // top-left (z-)
                ];
            }
        } else {
            // Top (y+) or Bottom (y-)
            if (n.y === 1) {
                // Top face: CCW from outside (positive Y looking down)
                // x: left(-1) to right(1), z: front(1) to back(-1) [from above, +z is away]
                // Left-front (-1,1,1), Right-front (1,1,1), Right-back (1,1,-1), Left-back (-1,1,-1)
                corners = [
                    new THREE.Vector3(-half,  half,  half), // left-front
                    new THREE.Vector3( half,  half,  half), // right-front
                    new THREE.Vector3( half,  half, -half), // right-back
                    new THREE.Vector3(-half,  half, -half), // left-back
                ];
            } else {
                // Bottom face (y-): CCW from outside (negative Y looking up)
                // x: left(-1) to right(1), z: back(-1) to front(1) [from below, +z is toward]
                // Left-back (-1,-1,-1), Left-front (-1,-1,1), Right-front (1,-1,1), Right-back (1,-1,-1)
                corners = [
                    new THREE.Vector3(-half, -half, -half), // left-back
                    new THREE.Vector3(-half, -half,  half), // left-front
                    new THREE.Vector3( half, -half,  half), // right-front
                    new THREE.Vector3( half, -half, -half), // right-back
                ];
            }
        }

        corners.forEach((corner, i) => {
            positions.push(corner.x, corner.y, corner.z);
            normals.push(n.x, n.y, n.z);
            uvs.push(face.uv[i][0], face.uv[i][1]);
        });

        indices.push(vertexIndex, vertexIndex + 1, vertexIndex + 2);
        indices.push(vertexIndex, vertexIndex + 2, vertexIndex + 3);
        vertexIndex += 4;
    });

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeBoundingSphere();
    return geometry;
}

function buildCubeEdgesGeometry(excludedFaces = new Set()) {
    const half = 1;
    const allEdges = [
        [new THREE.Vector3(-half, -half, half), new THREE.Vector3(half, -half, half)],
        [new THREE.Vector3(half, -half, half), new THREE.Vector3(half, half, half)],
        [new THREE.Vector3(half, half, half), new THREE.Vector3(-half, half, half)],
        [new THREE.Vector3(-half, half, half), new THREE.Vector3(-half, -half, half)],
        [new THREE.Vector3(-half, -half, -half), new THREE.Vector3(half, -half, -half)],
        [new THREE.Vector3(half, -half, -half), new THREE.Vector3(half, half, -half)],
        [new THREE.Vector3(half, half, -half), new THREE.Vector3(-half, half, -half)],
        [new THREE.Vector3(-half, half, -half), new THREE.Vector3(-half, -half, -half)],
        [new THREE.Vector3(-half, -half, -half), new THREE.Vector3(-half, -half, half)],
        [new THREE.Vector3(half, -half, -half), new THREE.Vector3(half, -half, half)],
        [new THREE.Vector3(half, half, -half), new THREE.Vector3(half, half, half)],
        [new THREE.Vector3(-half, half, -half), new THREE.Vector3(-half, half, half)],
    ];

    const edgeFaces = [
        [0, 4], [0, 2], [0, 5], [0, 3],
        [1, 4], [1, 2], [1, 5], [1, 3],
        [0, 1], [2, 3], [5, 4], [3, 4],
    ];

    const positions = [];
    edgeFaces.forEach((faces, i) => {
        const hasFace = faces.some(f => !excludedFaces.has(f));
        if (hasFace) {
            positions.push(...allEdges[i][0].toArray(), ...allEdges[i][1].toArray());
        }
    });

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    return geometry;
}

// ============ SOLID CUBE WITH DESTRUCTIBLE FACES ============
class SolidCube {
    constructor(scene) {
        this.scene = scene;
        this.cube = null;
        this.wireframe = null;
        this.crackMeshes = new Map(); // faceIdx -> crack mesh
        this.destroyedFaces = new Set();
        this.faceClickCounts = [0, 0, 0, 0, 0, 0];
        this.clicksPerFaceToDestroy = 4;
        this.perfectClickWindow = 0.18;
        this.faceNormals = [
            new THREE.Vector3(0, 0, 1),   // Front
            new THREE.Vector3(0, 0, -1),  // Back
            new THREE.Vector3(1, 0, 0),   // Right
            new THREE.Vector3(-1, 0, 0),  // Left
            new THREE.Vector3(0, 1, 0),   // Top
            new THREE.Vector3(0, -1, 0),  // Bottom
        ];
        this.crackSystem = new CrackSystem();
        
        this.createSolidCube();
    }

    createSolidCube() {
        const geometry = buildCubeGeometry(this.destroyedFaces);
        const material = new THREE.MeshStandardMaterial({
            color: 0x111111,
            roughness: 0.3,
            metalness: 0.15,
        });
        this.cube = new THREE.Mesh(geometry, material);
        this.scene.add(this.cube);

        // Edge lines
        const edgesGeometry = buildCubeEdgesGeometry(this.destroyedFaces);
        const lineMat = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 1, transparent: true, opacity: 0.3 });
        this.wireframe = new THREE.LineSegments(edgesGeometry, lineMat);
        this.cube.add(this.wireframe);

        // Add crack meshes for non-destroyed faces
        this.updateCrackMeshes();
    }

    updateCrackMeshes() {
        // Remove crack meshes for destroyed faces
        this.crackMeshes.forEach((mesh, faceIdx) => {
            if (this.destroyedFaces.has(faceIdx)) {
                this.scene.remove(mesh);
                mesh.geometry.dispose();
                mesh.material.map?.dispose();
                mesh.material.dispose();
                this.crackMeshes.delete(faceIdx);
                this.crackSystem.removeCrackMesh(faceIdx);
            }
        });

        // Add crack meshes for new faces
        const half = 1;
        this.faceNormals.forEach((normal, faceIdx) => {
            if (this.destroyedFaces.has(faceIdx)) return;
            if (this.crackMeshes.has(faceIdx)) return;

            let faceCenter;
            if (Math.abs(normal.z) === 1) {
                faceCenter = new THREE.Vector3(0, 0, normal.z * half);
            } else if (Math.abs(normal.x) === 1) {
                faceCenter = new THREE.Vector3(normal.x * half, 0, 0);
            } else {
                faceCenter = new THREE.Vector3(0, normal.y * half, 0);
            }

            const crackMesh = this.crackSystem.createCrackMesh(faceIdx, normal, faceCenter);
            this.cube.add(crackMesh);
            this.crackMeshes.set(faceIdx, crackMesh);
        });
    }

    rebuildCube() {
        // Dispose old geometry
        if (this.cube) {
            this.cube.geometry.dispose();
            if (this.wireframe) {
                this.wireframe.geometry.dispose();
                this.cube.remove(this.wireframe);
            }
            // Keep crack meshes - they'll be reparented
            const oldCrackMeshes = new Map(this.crackMeshes);
            this.crackMeshes.clear();
            this.scene.remove(this.cube);
        }
        this.createSolidCube();
    }

    checkClick(raycaster, camera) {
        if (this.destroyedFaces.size >= 6) return false;
        
        const intersects = raycaster.intersectObject(this.cube, true);
        if (intersects.length > 0) {
            const faceNormal = intersects[0].face.normal.clone();
            faceNormal.transformDirection(this.cube.matrixWorld);
            
            let faceIdx = -1;
            let maxDot = -1;
            this.faceNormals.forEach((normal, i) => {
                if (this.destroyedFaces.has(i)) return;
                const dot = normal.dot(faceNormal);
                if (dot > maxDot) {
                    maxDot = dot;
                    faceIdx = i;
                }
            });
            
            if (faceIdx !== -1 && maxDot > 0.9) {
                this.handleFaceClick(faceIdx, intersects[0].point);
                return true;
            }
        }
        return false;
    }

    handleFaceClick(faceIdx, hitPoint) {
        // Every click on a face counts toward its destruction, regardless of beat timing.
        this.faceClickCounts[faceIdx]++;

        // Add crack to this face
        this.crackSystem.addCrack(faceIdx, hitPoint, this.faceNormals[faceIdx], this.cube.matrixWorld);

        // Hit particles
        this.createHitParticles(hitPoint.clone(), this.faceNormals[faceIdx]);

        if (this.faceClickCounts[faceIdx] >= this.clicksPerFaceToDestroy) {
            this.destroyFace(faceIdx, hitPoint);
        }
    }

    createHitParticles(position, normal) {
        const particleCount = 8;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        const velocities = [];
        const colors = new Float32Array(particleCount * 3);
        const sizes = new Float32Array(particleCount);
        
        for (let i = 0; i < particleCount; i++) {
            positions[i * 3] = position.x;
            positions[i * 3 + 1] = position.y;
            positions[i * 3 + 2] = position.z;
            
            const spread = new THREE.Vector3(
                (Math.random() - 0.5) * 0.5,
                (Math.random() - 0.5) * 0.5,
                (Math.random() - 0.5) * 0.5
            ).add(normal.clone().multiplyScalar(1)).normalize().multiplyScalar(0.05 + Math.random() * 0.05);
            velocities.push(spread);
            
            const shade = 0.3 + Math.random() * 0.3;
            colors[i * 3] = shade;
            colors[i * 3 + 1] = shade;
            colors[i * 3 + 2] = shade;
            
            sizes[i] = 0.02 + Math.random() * 0.02;
        }
        
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
        
        const material = new THREE.PointsMaterial({
            vertexColors: true,
            transparent: true,
            opacity: 1,
            sizeAttenuation: true
        });
        
        const particles = new THREE.Points(geometry, material);
        this.scene.add(particles);
        
        const startTime = performance.now() / 1000;
        const duration = 0.5;
        
        const animateParticles = () => {
            const elapsed = (performance.now() / 1000) - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            const posAttr = geometry.getAttribute('position');
            const sizeAttr = geometry.getAttribute('size');
            for (let i = 0; i < particleCount; i++) {
                posAttr.setXYZ(i,
                    posAttr.getX(i) + velocities[i].x,
                    posAttr.getY(i) + velocities[i].y,
                    posAttr.getZ(i) + velocities[i].z
                );
                velocities[i].y -= 0.005;
                velocities[i].multiplyScalar(0.98);
                sizeAttr.setX(i, sizeAttr.getX(i) * 0.95);
            }
            posAttr.needsUpdate = true;
            sizeAttr.needsUpdate = true;
            material.opacity = 1 - progress;
            
            if (progress < 1) {
                requestAnimationFrame(animateParticles);
            } else {
                this.scene.remove(particles);
                geometry.dispose();
                material.dispose();
            }
        };
        animateParticles();
    }

    destroyFace(faceIdx, hitPoint) {
        this.destroyedFaces.add(faceIdx);
        
        // Remove crack mesh for this face
        const crackMesh = this.crackMeshes.get(faceIdx);
        if (crackMesh) {
            this.cube.remove(crackMesh);
            this.crackMeshes.delete(faceIdx);
            this.crackSystem.removeCrackMesh(faceIdx);
        }
        
        // Create exploding face piece
        this.createExplodingFace(faceIdx, hitPoint);
        
        // Rebuild cube without this face
        this.rebuildCube();
        
        if (this.destroyedFaces.size >= 6) {
            setTimeout(() => this.resetCube(), 2000);
        }
    }

    createExplodingFace(faceIdx, hitPoint) {
        const size = 2;
        const half = size / 2;
        const normal = this.faceNormals[faceIdx];
        const faceCenter = normal.clone().multiplyScalar(half);
        
        const geometry = new THREE.PlaneGeometry(size, size, 5, 5);
        const material = new THREE.MeshStandardMaterial({
            color: 0x111111,
            roughness: 0.3,
            metalness: 0.15,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 1
        });
        const faceMesh = new THREE.Mesh(geometry, material);
        
        faceMesh.position.copy(this.cube.position).add(faceCenter);
        faceMesh.lookAt(faceMesh.position.clone().add(normal));
        faceMesh.rotateY(Math.PI);
        
        const edges = new THREE.EdgesGeometry(geometry);
        const lineMat = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 1, transparent: true, opacity: 0.5 });
        const wire = new THREE.LineSegments(edges, lineMat);
        faceMesh.add(wire);
        faceMesh.userData.wireframe = wire;
        
        this.scene.add(faceMesh);
        this.animateFaceExplosion(faceMesh, normal, hitPoint);
    }

    animateFaceExplosion(faceMesh, normal, hitPoint) {
        const duration = 2.0;
        const startPos = faceMesh.position.clone();
        const startRot = faceMesh.rotation.clone();
        
        const toHit = faceMesh.position.clone().sub(hitPoint).normalize();
        const explodeDir = normal.clone().add(toHit.multiplyScalar(0.5)).normalize();
        const targetPos = startPos.clone().add(explodeDir.multiplyScalar(15));
        const targetRot = new THREE.Euler(
            startRot.x + (Math.random() - 0.5) * 8,
            startRot.y + (Math.random() - 0.5) * 8,
            startRot.z + (Math.random() - 0.5) * 8
        );
        
        const startTime = performance.now() / 1000;
        
        const animateFace = () => {
            const elapsed = (performance.now() / 1000) - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = this.easeOutCubic(progress);
            
            faceMesh.position.lerpVectors(startPos, targetPos, eased);
            faceMesh.rotation.x = THREE.MathUtils.lerp(startRot.x, targetRot.x, eased);
            faceMesh.rotation.y = THREE.MathUtils.lerp(startRot.y, targetRot.y, eased);
            faceMesh.rotation.z = THREE.MathUtils.lerp(startRot.z, targetRot.z, eased);
            
            faceMesh.material.opacity = 1 - eased;
            if (faceMesh.userData.wireframe) {
                faceMesh.userData.wireframe.material.opacity = (1 - eased) * 0.5;
            }
            
            if (progress < 1) {
                requestAnimationFrame(animateFace);
            } else {
                this.scene.remove(faceMesh);
                faceMesh.geometry.dispose();
                faceMesh.material.dispose();
                if (faceMesh.userData.wireframe) {
                    faceMesh.userData.wireframe.geometry.dispose();
                    faceMesh.userData.wireframe.material.dispose();
                }
            }
        };
        animateFace();
        
        this.createParticles(hitPoint.clone(), explodeDir);
    }

    createParticles(position, direction) {
        const particleCount = 30;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        const velocities = [];
        const colors = new Float32Array(particleCount * 3);
        const sizes = new Float32Array(particleCount);
        
        for (let i = 0; i < particleCount; i++) {
            positions[i * 3] = position.x;
            positions[i * 3 + 1] = position.y;
            positions[i * 3 + 2] = position.z;
            
            const spread = new THREE.Vector3(
                (Math.random() - 0.5) * 1.5,
                (Math.random() - 0.5) * 1.5,
                (Math.random() - 0.5) * 1.5
            ).add(direction.clone().multiplyScalar(2)).normalize().multiplyScalar(0.08 + Math.random() * 0.15);
            velocities.push(spread);
            
            const shade = 0.05 + Math.random() * 0.1;
            colors[i * 3] = shade;
            colors[i * 3 + 1] = shade;
            colors[i * 3 + 2] = shade;
            
            sizes[i] = 0.03 + Math.random() * 0.04;
        }
        
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
        
        const material = new THREE.PointsMaterial({
            vertexColors: true,
            transparent: true,
            opacity: 1,
            sizeAttenuation: true
        });
        
        const particles = new THREE.Points(geometry, material);
        this.scene.add(particles);
        
        const startTime = performance.now() / 1000;
        const duration = 1.5;
        
        const animateParticles = () => {
            const elapsed = (performance.now() / 1000) - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            const posAttr = geometry.getAttribute('position');
            const sizeAttr = geometry.getAttribute('size');
            for (let i = 0; i < particleCount; i++) {
                posAttr.setXYZ(i,
                    posAttr.getX(i) + velocities[i].x,
                    posAttr.getY(i) + velocities[i].y,
                    posAttr.getZ(i) + velocities[i].z
                );
                velocities[i].y -= 0.003;
                velocities[i].multiplyScalar(0.99);
                sizeAttr.setX(i, sizeAttr.getX(i) * 0.99);
            }
            posAttr.needsUpdate = true;
            sizeAttr.needsUpdate = true;
            material.opacity = 1 - progress;
            
            if (progress < 1) {
                requestAnimationFrame(animateParticles);
            } else {
                this.scene.remove(particles);
                geometry.dispose();
                material.dispose();
            }
        };
        animateParticles();
    }

    resetCube() {
        if (this.cube) {
            this.cube.geometry.dispose();
            this.cube.material.dispose();
            if (this.wireframe) {
                this.wireframe.geometry.dispose();
                this.wireframe.material.dispose();
            }
            this.scene.remove(this.cube);
        }
        this.crackSystem.reset();
        this.crackMeshes.clear();
        this.destroyedFaces.clear();
        this.faceClickCounts = [0, 0, 0, 0, 0, 0];
        this.createSolidCube();
    }

    easeOutCubic(t) {
        return 1 - Math.pow(1 - t, 3);
    }

    update() {
        const time = performance.now() / 1000;
        if (this.cube && this.destroyedFaces.size < 6) {
            const scale = 1 + Math.sin(time * 0.8) * 0.01;
            this.cube.scale.setScalar(scale);
        }
    }
}

// ============ MAIN GAME ============
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xffffff);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 4;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.getElementById('app').appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.minDistance = 3;
controls.maxDistance = 10;
controls.enablePan = false;

const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(5, 10, 7);
scene.add(dirLight);

const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0xe0e0e0, 0.5);
scene.add(hemisphereLight);

const rimLight = new THREE.DirectionalLight(0xffffff, 0.3);
rimLight.position.set(-5, -5, -5);
scene.add(rimLight);

const audioEngine = new AudioEngine();
const cube = new SolidCube(scene);

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

const beatIndicator = document.createElement('div');
beatIndicator.style.cssText = `
    position: fixed;
    bottom: 30px;
    left: 50%;
    transform: translateX(-50%);
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #333;
    opacity: 0.4;
    pointer-events: none;
    z-index: 100;
    transition: transform 0.05s, opacity 0.05s, background 0.05s;
`;
document.body.appendChild(beatIndicator);

function onMouseMove(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
}

function onClick(event) {
    if (event.target !== renderer.domElement) return;
    
    audioEngine.resume();
    if (!audioEngine.isPlaying) audioEngine.start();
    
    raycaster.setFromCamera(mouse, camera);
    cube.checkClick(raycaster, camera);
}

window.addEventListener('mousemove', onMouseMove);
window.addEventListener('click', onClick);

window.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
        const touch = e.touches[0];
        mouse.x = (touch.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(touch.clientY / window.innerHeight) * 2 + 1;
        audioEngine.resume();
        if (!audioEngine.isPlaying) audioEngine.start();
        raycaster.setFromCamera(mouse, camera);
        cube.checkClick(raycaster, camera);
    }
}, { passive: true });

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

audioEngine.onBeat((time) => {
    beatIndicator.style.transform = 'translateX(-50%) scale(2)';
    beatIndicator.style.opacity = '1';
    beatIndicator.style.background = '#000';
    setTimeout(() => {
        beatIndicator.style.transform = 'translateX(-50%) scale(1)';
        beatIndicator.style.opacity = '0.4';
        beatIndicator.style.background = '#333';
    }, 80);
});

function animate() {
    requestAnimationFrame(animate);
    
    cube.update();
    
    if (audioEngine.isPlaying) {
        const progress = audioEngine.getBeatProgress();
        const pulseScale = 1 + Math.sin(progress * Math.PI * 2) * 0.4;
        const pulseOpacity = 0.4 + 0.3 * Math.sin(progress * Math.PI * 2);
        beatIndicator.style.transform = `translateX(-50%) scale(${pulseScale})`;
        beatIndicator.style.opacity = pulseOpacity;
    }
    
    if (cube.cube) {
        cube.cube.rotation.x += 0.0003;
        cube.cube.rotation.y += 0.0005;
    }
    
    controls.update();
    renderer.render(scene, camera);
}

document.body.addEventListener('click', () => {
    audioEngine.resume();
    if (!audioEngine.isPlaying) audioEngine.start();
}, { once: true });

animate();

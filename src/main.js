import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xffffff); // White background

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 0, 5);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.enablePan = false;
controls.minDistance = 3;
controls.maxDistance = 10;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.3;

// Create cube as 6 separate face meshes
const faceSize = 2;
const halfSize = faceSize / 2;
const faces = [];

// Face data: [position, rotation, normal]
const faceData = [
    // Front (+Z)
    { pos: [0, 0, halfSize], rot: [0, 0, 0], normal: [0, 0, 1] },
    // Back (-Z)
    { pos: [0, 0, -halfSize], rot: [0, Math.PI, 0], normal: [0, 0, -1] },
    // Right (+X)
    { pos: [halfSize, 0, 0], rot: [0, -Math.PI / 2, 0], normal: [1, 0, 0] },
    // Left (-X)
    { pos: [-halfSize, 0, 0], rot: [0, Math.PI / 2, 0], normal: [-1, 0, 0] },
    // Top (+Y)
    { pos: [0, halfSize, 0], rot: [-Math.PI / 2, 0, 0], normal: [0, 1, 0] },
    // Bottom (-Y)
    { pos: [0, -halfSize, 0], rot: [Math.PI / 2, 0, 0], normal: [0, -1, 0] },
];

const faceGeometry = new THREE.PlaneGeometry(faceSize, faceSize);

// Crack texture generator - produces both visible (map) and alpha (alphaMap) textures
class CrackTexture {
    constructor(size = 512) {
        this.size = size;
        
        // Visible texture: black background with gray/white cracks (for map)
        this.visibleCanvas = document.createElement('canvas');
        this.visibleCanvas.width = size;
        this.visibleCanvas.height = size;
        this.visibleCtx = this.visibleCanvas.getContext('2d');
        this.visibleTexture = new THREE.CanvasTexture(this.visibleCanvas);
        this.visibleTexture.wrapS = THREE.ClampToEdgeWrapping;
        this.visibleTexture.wrapT = THREE.ClampToEdgeWrapping;
        
        // Alpha texture: white background with black cracks (for alphaMap on shatter pieces)
        this.alphaCanvas = document.createElement('canvas');
        this.alphaCanvas.width = size;
        this.alphaCanvas.height = size;
        this.alphaCtx = this.alphaCanvas.getContext('2d');
        this.alphaTexture = new THREE.CanvasTexture(this.alphaCanvas);
        this.alphaTexture.wrapS = THREE.ClampToEdgeWrapping;
        this.alphaTexture.wrapT = THREE.ClampToEdgeWrapping;
        
        this.cracks = []; // Array of crack paths
        this.clear();
    }

    clear() {
        // Visible: black background (matches cube face color)
        this.visibleCtx.fillStyle = '#000000';
        this.visibleCtx.fillRect(0, 0, this.size, this.size);
        
        // Alpha: white background (opaque)
        this.alphaCtx.fillStyle = 'white';
        this.alphaCtx.fillRect(0, 0, this.size, this.size);
        
        this.cracks = [];
        this.visibleTexture.needsUpdate = true;
        this.alphaTexture.needsUpdate = true;
    }

    // Generate a lightning-like crack path
    generateCrack() {
        const path = [];
        const startX = Math.random() * this.size;
        const startY = Math.random() * this.size;
        path.push({ x: startX, y: startY });

        const segments = 8 + Math.floor(Math.random() * 8);
        let x = startX;
        let y = startY;
        let angle = Math.random() * Math.PI * 2;

        for (let i = 0; i < segments; i++) {
            const length = 20 + Math.random() * 40;
            angle += (Math.random() - 0.5) * 1.2; // Random walk
            x += Math.cos(angle) * length;
            y += Math.sin(angle) * length;

            // Bounce off edges
            if (x < 0) { x = -x; angle = Math.PI - angle; }
            if (x > this.size) { x = 2 * this.size - x; angle = Math.PI - angle; }
            if (y < 0) { y = -y; angle = -angle; }
            if (y > this.size) { y = 2 * this.size - y; angle = -angle; }

            path.push({ x, y });

            // Occasionally branch
            if (Math.random() < 0.15 && i > 2) {
                const branchAngle = angle + (Math.random() - 0.5) * Math.PI;
                const branchLength = 15 + Math.random() * 30;
                const bx = x + Math.cos(branchAngle) * branchLength;
                const by = y + Math.sin(branchAngle) * branchLength;
                this.cracks.push([{ x, y }, { x: bx, y: by }]);
            }
        }
        this.cracks.push(path);
    }

    // Add N new cracks and redraw
    addCracks(count) {
        for (let i = 0; i < count; i++) {
            this.generateCrack();
        }
        this.redraw();
    }

    redraw() {
        // Visible texture: black bg, gray/white cracks
        this.visibleCtx.fillStyle = '#000000';
        this.visibleCtx.fillRect(0, 0, this.size, this.size);

        // Alpha texture: white bg, black cracks
        this.alphaCtx.fillStyle = 'white';
        this.alphaCtx.fillRect(0, 0, this.size, this.size);

        // Draw main cracks
        this.cracks.forEach(path => {
            if (path.length < 2) return;
            
            // Visible: draw gray/white crack lines
            this.visibleCtx.strokeStyle = '#666666'; // Medium gray - visible on black
            this.visibleCtx.lineWidth = 2.0;
            this.visibleCtx.lineCap = 'round';
            this.visibleCtx.lineJoin = 'round';
            this.visibleCtx.beginPath();
            this.visibleCtx.moveTo(path[0].x, path[0].y);
            for (let i = 1; i < path.length; i++) {
                this.visibleCtx.lineTo(path[i].x, path[i].y);
            }
            this.visibleCtx.stroke();
            
            // Add highlight for glass-like effect
            this.visibleCtx.strokeStyle = '#aaaaaa'; // Lighter highlight
            this.visibleCtx.lineWidth = 0.8;
            this.visibleCtx.beginPath();
            this.visibleCtx.moveTo(path[0].x, path[0].y);
            for (let i = 1; i < path.length; i++) {
                this.visibleCtx.lineTo(path[i].x, path[i].y);
            }
            this.visibleCtx.stroke();

            // Alpha: draw black crack lines (transparent)
            this.alphaCtx.strokeStyle = 'black';
            this.alphaCtx.lineWidth = 2.5; // Slightly wider for clean edges
            this.alphaCtx.lineCap = 'round';
            this.alphaCtx.lineJoin = 'round';
            this.alphaCtx.beginPath();
            this.alphaCtx.moveTo(path[0].x, path[0].y);
            for (let i = 1; i < path.length; i++) {
                this.alphaCtx.lineTo(path[i].x, path[i].y);
            }
            this.alphaCtx.stroke();
        });

        // Add fine detail cracks
        this.cracks.forEach(path => {
            if (path.length < 3) return;
            for (let i = 1; i < path.length - 1; i += 2) {
                if (Math.random() < 0.3) {
                    const px = path[i].x;
                    const py = path[i].y;
                    const angle = Math.random() * Math.PI * 2;
                    const len = 5 + Math.random() * 15;
                    
                    // Visible detail
                    this.visibleCtx.strokeStyle = '#555555';
                    this.visibleCtx.lineWidth = 1.0;
                    this.visibleCtx.beginPath();
                    this.visibleCtx.moveTo(px, py);
                    this.visibleCtx.lineTo(px + Math.cos(angle) * len, py + Math.sin(angle) * len);
                    this.visibleCtx.stroke();
                    
                    // Alpha detail
                    this.alphaCtx.strokeStyle = 'black';
                    this.alphaCtx.lineWidth = 1.5;
                    this.alphaCtx.beginPath();
                    this.alphaCtx.moveTo(px, py);
                    this.alphaCtx.lineTo(px + Math.cos(angle) * len, py + Math.sin(angle) * len);
                    this.alphaCtx.stroke();
                }
            }
        });

        this.visibleTexture.needsUpdate = true;
        this.alphaTexture.needsUpdate = true;
    }

    getVisibleTexture() {
        return this.visibleTexture;
    }

    getAlphaTexture() {
        return this.alphaTexture;
    }

    getCrackCount() {
        return this.cracks.length;
    }
}

faceData.forEach((data, index) => {
    // Each face gets its own crack texture generator
    const crackTexture = new CrackTexture(512);
    
    // Main face material: use visible texture as map (color), no transparency
    const faceMaterial = new THREE.MeshStandardMaterial({
        color: 0x000000,
        roughness: 0.35,
        metalness: 0.0,
        side: THREE.DoubleSide,
        map: crackTexture.getVisibleTexture(), // Visible cracks on black surface
        // No alphaMap, no transparent - cracks are just color on the surface
    });
    
    const face = new THREE.Mesh(faceGeometry, faceMaterial);
    face.position.set(...data.pos);
    face.rotation.set(...data.rot);
    face.userData = { 
        faceIndex: index, 
        originalPosition: data.pos, 
        originalRotation: data.rot,
        clickCount: 0,
        maxClicks: 4,
        crackTexture: crackTexture,
    };
    scene.add(face);
    faces.push(face);
});

// Wireframe - create edges for the whole cube
const cubeGeometry = new THREE.BoxGeometry(faceSize, faceSize, faceSize);
const edges = new THREE.EdgesGeometry(cubeGeometry);
const lineMaterial = new THREE.LineBasicMaterial({ 
    color: 0x333333, 
    transparent: true, 
    opacity: 0.4 
});
const wireframe = new THREE.LineSegments(edges, lineMaterial);
scene.add(wireframe);

// Group for rotation (contains faces + wireframe)
const cubeGroup = new THREE.Group();
faces.forEach(face => cubeGroup.add(face));
cubeGroup.add(wireframe);
scene.add(cubeGroup);

// Lighting - multiple soft white lights
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.7);
directionalLight.position.set(5, 10, 7);
scene.add(directionalLight);

const fillLight = new THREE.DirectionalLight(0xffffff, 0.5);
fillLight.position.set(-5, 5, -7);
scene.add(fillLight);

const topLight = new THREE.DirectionalLight(0xffffff, 0.4);
topLight.position.set(0, 10, 0);
scene.add(topLight);

const sideLight1 = new THREE.DirectionalLight(0xffffff, 0.3);
sideLight1.position.set(10, 0, 5);
scene.add(sideLight1);

const sideLight2 = new THREE.DirectionalLight(0xffffff, 0.3);
sideLight2.position.set(-10, 0, -5);
scene.add(sideLight2);

// Raycaster for click detection
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// Click handler
function onClick(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(faces.filter(f => f.visible), true);

    if (intersects.length > 0) {
        const hitFace = intersects[0].object;
        handleFaceClick(hitFace);
    }
}

function handleFaceClick(face) {
    const userData = face.userData;
    userData.clickCount++;
    
    // Add more cracks with each click
    // Click 1: 3 cracks, Click 2: 5 cracks, Click 3: 8 cracks, Click 4: shatter
    const cracksToAdd = [3, 5, 8, 0][userData.clickCount - 1] || 0;
    if (cracksToAdd > 0) {
        userData.crackTexture.addCracks(cracksToAdd);
    }
    
    // If 4th click, animate shatter disappearance
    if (userData.clickCount >= userData.maxClicks) {
        animateFaceShatter(face);
    }
}

function animateFaceShatter(face) {
    const userData = face.userData;
    const crackTexture = userData.crackTexture;
    
    // Create shatter pieces from the crack pattern
    const pieces = createShatterPieces(face, crackTexture);
    
    // Animate pieces flying off
    const startTime = performance.now();
    const duration = 1200; // Longer duration for more dramatic effect
    
    function animatePieces() {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        // Ease out cubic for dramatic slow-down
        const eased = 1 - Math.pow(1 - progress, 3);
        
        pieces.forEach((piece, i) => {
            const delay = i * 0.008; // Staggered start
            const pieceProgress = Math.max(0, (progress - delay) / (1 - delay));
            if (pieceProgress <= 0) return;
            
            const pieceEased = 1 - Math.pow(1 - pieceProgress, 3);
            
            // Fly outward with gravity and air resistance
            piece.position.x += piece.userData.velocity.x * pieceEased;
            piece.position.y += piece.userData.velocity.y * pieceEased;
            piece.position.z += piece.userData.velocity.z * pieceEased;
            
            // Apply gravity
            piece.userData.velocity.y -= 0.0008 * pieceEased;
            
            // Apply air resistance
            piece.userData.velocity.multiplyScalar(0.995);
            
            // Rotate chaotically
            piece.rotation.x += piece.userData.angularVelocity.x;
            piece.rotation.y += piece.userData.angularVelocity.y;
            piece.rotation.z += piece.userData.angularVelocity.z;
            
            // Fade out near the end
            if (pieceProgress > 0.7) {
                piece.material.opacity = 1 - (pieceProgress - 0.7) / 0.3;
                piece.material.transparent = true;
                piece.material.needsUpdate = true;
            }
        });
        
        if (progress < 1) {
            requestAnimationFrame(animatePieces);
        } else {
            // Cleanup
            pieces.forEach(piece => {
                scene.remove(piece);
                piece.geometry.dispose();
                piece.material.dispose();
            });
            face.visible = false;
            // Reset crack texture for potential reuse
            crackTexture.clear();
            userData.clickCount = 0;
        }
    }
    
    // Hide original face immediately
    face.visible = false;
    animatePieces();
}

function createShatterPieces(face, crackTexture) {
    const pieces = [];
    // More pieces for more chaos
    const pieceCount = 25 + Math.floor(Math.random() * 15); // 25-40 pieces
    
    // Get face world position and rotation
    const worldPos = new THREE.Vector3();
    const worldQuat = new THREE.Quaternion();
    face.getWorldPosition(worldPos);
    face.getWorldQuaternion(worldQuat);
    
    // Get face normal for outward explosion
    const faceNormal = new THREE.Vector3(0, 0, 1).applyQuaternion(worldQuat);
    
    for (let i = 0; i < pieceCount; i++) {
        // Create varied shard geometries - not just boxes
        const geo = createShardGeometry();
        
        // Shatter piece material: visible cracks + alpha transparency for crack holes
        const mat = new THREE.MeshStandardMaterial({
            color: 0x000000,
            roughness: 0.35,
            metalness: 0.0,
            side: THREE.DoubleSide,
            map: crackTexture.getVisibleTexture(),
            alphaMap: crackTexture.getAlphaTexture(),
            transparent: true,
            alphaTest: 0.01,
        });
        mat.needsUpdate = true;
        
        const piece = new THREE.Mesh(geo, mat);
        
        // Position near face center with random offset
        const offset = new THREE.Vector3(
            (Math.random() - 0.5) * 1.5,
            (Math.random() - 0.5) * 1.5,
            (Math.random() - 0.5) * 0.2
        );
        offset.applyQuaternion(worldQuat);
        piece.position.copy(worldPos).add(offset);
        
        // Random initial rotation
        piece.rotation.set(
            Math.random() * Math.PI * 2,
            Math.random() * Math.PI * 2,
            Math.random() * Math.PI * 2
        );
        
        // CHAOTIC velocity - explode in ALL directions
        // Base outward velocity from face center
        const outwardDir = new THREE.Vector3(
            (Math.random() - 0.5) * 2,
            (Math.random() - 0.5) * 2,
            (Math.random() - 0.5) * 2
        ).normalize();
        
        // Strong outward component along face normal + random chaos
        const explosionForce = 0.08 + Math.random() * 0.12; // 0.08-0.20
        const velocity = outwardDir.multiplyScalar(explosionForce);
        
        // Add strong component along face normal (forward/backward)
        velocity.addScaledVector(faceNormal, (Math.random() - 0.5) * 0.15);
        
        // Add some initial spin
        const angularVelocity = new THREE.Vector3(
            (Math.random() - 0.5) * 0.15,
            (Math.random() - 0.5) * 0.15,
            (Math.random() - 0.5) * 0.15
        );
        
        // Add wobble/tumble
        piece.userData = { 
            velocity, 
            angularVelocity,
            // Add some randomness to gravity effect
            gravityMultiplier: 0.5 + Math.random() * 1.5,
            // Add spin decay
            spinDecay: 0.98 + Math.random() * 0.015
        };
        
        scene.add(piece);
        pieces.push(piece);
    }
    
    return pieces;
}

function createShardGeometry() {
    // Create varied, irregular shard shapes
    const shapeType = Math.random();
    
    if (shapeType < 0.3) {
        // Thin irregular plate (most glass-like)
        const width = 0.08 + Math.random() * 0.25;
        const height = 0.08 + Math.random() * 0.25;
        const depth = 0.01 + Math.random() * 0.02;
        const geo = new THREE.BoxGeometry(width, height, depth);
        // Add slight vertex distortion
        distortGeometry(geo, 0.15);
        return geo;
    } else if (shapeType < 0.55) {
        // Triangular shard
        const size = 0.1 + Math.random() * 0.2;
        const geo = new THREE.BufferGeometry();
        const vertices = new Float32Array([
            // Front face
            0, size * 0.5, 0,
            -size * 0.5, -size * 0.5, 0,
            size * 0.5, -size * 0.5, 0,
            // Back face
            0, size * 0.5, -0.02,
            size * 0.5, -size * 0.5, -0.02,
            -size * 0.5, -size * 0.5, -0.02,
        ]);
        const indices = [
            0, 1, 2,    // front
            3, 4, 5,    // back
            0, 2, 4,    // right
            4, 1, 0,    // left (corrected winding)
            1, 4, 5,    // bottom
            5, 2, 1,    // bottom back
            2, 5, 3,    // left side
            3, 0, 2,    // top
        ];
        geo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
        geo.setIndex(indices);
        geo.computeVertexNormals();
        distortGeometry(geo, 0.2);
        return geo;
    } else if (shapeType < 0.75) {
        // Long thin shard (needle-like)
        const length = 0.15 + Math.random() * 0.3;
        const width = 0.03 + Math.random() * 0.04;
        const depth = 0.01 + Math.random() * 0.015;
        const geo = new THREE.BoxGeometry(width, length, depth);
        distortGeometry(geo, 0.25);
        return geo;
    } else {
        // Chunky irregular piece
        const size = 0.12 + Math.random() * 0.18;
        const geo = new THREE.BoxGeometry(size, size, 0.02 + Math.random() * 0.03);
        distortGeometry(geo, 0.3);
        return geo;
    }
}

function distortGeometry(geometry, amount) {
    const position = geometry.attributes.position;
    for (let i = 0; i < position.count; i++) {
        const x = position.getX(i);
        const y = position.getY(i);
        const z = position.getZ(i);
        
        // Add random distortion
        position.setXYZ(i,
            x + (Math.random() - 0.5) * amount * Math.abs(x) * 0.5,
            y + (Math.random() - 0.5) * amount * Math.abs(y) * 0.5,
            z + (Math.random() - 0.5) * amount * 0.5
        );
    }
    position.needsUpdate = true;
    geometry.computeVertexNormals();
}

window.addEventListener('click', onClick);

// Minimal Audio Engine
class AudioEngine {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.masterGain = this.ctx.createGain();
        this.masterGain.connect(this.ctx.destination);
        this.masterGain.gain.value = 0.15;
        this.isPlaying = false;
    }

    resume() {
        if (this.ctx.state === 'suspended') this.ctx.resume();
    }

    start() {
        if (this.isPlaying) return;
        this.isPlaying = true;
        this.scheduleLoop();
    }

    stop() {
        this.isPlaying = false;
    }

    scheduleLoop() {
        if (!this.isPlaying) return;
        
        const now = this.ctx.currentTime;
        const bpm = 70;
        const beatInterval = 60 / bpm;
        
        for (let i = 0; i < 4; i++) {
            const time = now + i * beatInterval;
            this.scheduleBeat(time, i % 4);
        }
        
        setTimeout(() => this.scheduleLoop(), beatInterval * 4 * 1000 * 0.95);
    }

    scheduleBeat(time, beatIndex) {
        if (beatIndex % 2 === 0) {
            const kick = this.ctx.createOscillator();
            const kickGain = this.ctx.createGain();
            kick.connect(kickGain);
            kickGain.connect(this.masterGain);
            kick.frequency.setValueAtTime(60, time);
            kick.frequency.exponentialRampToValueAtTime(30, time + 0.8);
            kickGain.gain.setValueAtTime(0.8, time);
            kickGain.gain.exponentialRampToValueAtTime(0.001, time + 0.8);
            kick.start(time);
            kick.stop(time + 1);
        }

        if (beatIndex === 0) {
            this.playPad(time);
        }

        if (beatIndex % 2 === 1) {
            this.playHihat(time);
        }
    }

    playPad(time) {
        const frequencies = [65.41, 82.41, 98.00, 130.81];
        frequencies.forEach((freq) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            const filter = this.ctx.createBiquadFilter();
            osc.connect(filter);
            filter.connect(gain);
            gain.connect(this.masterGain);
            
            osc.type = 'sine';
            osc.frequency.value = freq;
            filter.type = 'lowpass';
            filter.frequency.value = 400;
            filter.Q.value = 2;
            
            gain.gain.setValueAtTime(0, time);
            gain.gain.linearRampToValueAtTime(0.05, time + 0.5);
            gain.gain.exponentialRampToValueAtTime(0.001, time + 6);
            
            osc.start(time);
            osc.stop(time + 7);
        });
    }

    playHihat(time) {
        const noise = this.ctx.createBufferSource();
        const bufferSize = this.ctx.sampleRate * 0.03;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * 0.1;
        noise.buffer = buffer;
        
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        
        filter.type = 'highpass';
        filter.frequency.value = 8000;
        gain.gain.setValueAtTime(0.05, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
        
        noise.start(time);
    }
}

const audioEngine = new AudioEngine();

function initAudio() {
    audioEngine.resume();
    if (!audioEngine.isPlaying) audioEngine.start();
    window.removeEventListener('click', initAudio);
    window.removeEventListener('keydown', initAudio);
}
window.addEventListener('click', initAudio);
window.addEventListener('keydown', initAudio);

// Resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    
    controls.update();
    
    // Subtle cube rotation
    cubeGroup.rotation.x += 0.0005;
    cubeGroup.rotation.y += 0.0008;
    
    // Pulse wireframe opacity slightly
    const time = performance.now() * 0.001;
    wireframe.material.opacity = 0.3 + Math.sin(time * 0.5) * 0.1;
    
    renderer.render(scene, camera);
}

animate();

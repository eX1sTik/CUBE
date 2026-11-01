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

// Crack texture generator
class CrackTexture {
    constructor(size = 512) {
        this.size = size;
        this.canvas = document.createElement('canvas');
        this.canvas.width = size;
        this.canvas.height = size;
        this.ctx = this.canvas.getContext('2d');
        this.cracks = []; // Array of crack paths
        this.texture = new THREE.CanvasTexture(this.canvas);
        this.texture.wrapS = THREE.ClampToEdgeWrapping;
        this.texture.wrapT = THREE.ClampToEdgeWrapping;
        this.clear();
    }

    clear() {
        this.ctx.fillStyle = 'white'; // White = opaque (no cracks)
        this.ctx.fillRect(0, 0, this.size, this.size);
        this.cracks = [];
        this.texture.needsUpdate = true;
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
        this.ctx.fillStyle = 'white';
        this.ctx.fillRect(0, 0, this.size, this.size);

        this.ctx.strokeStyle = 'black'; // Black = transparent (cracks)
        this.ctx.lineWidth = 1.5;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';

        // Draw main cracks
        this.cracks.forEach(path => {
            if (path.length < 2) return;
            this.ctx.beginPath();
            this.ctx.moveTo(path[0].x, path[0].y);
            for (let i = 1; i < path.length; i++) {
                this.ctx.lineTo(path[i].x, path[i].y);
            }
            this.ctx.stroke();
        });

        // Add fine detail cracks
        this.ctx.lineWidth = 0.8;
        this.cracks.forEach(path => {
            if (path.length < 3) return;
            for (let i = 1; i < path.length - 1; i += 2) {
                if (Math.random() < 0.3) {
                    const px = path[i].x;
                    const py = path[i].y;
                    const angle = Math.random() * Math.PI * 2;
                    const len = 5 + Math.random() * 15;
                    this.ctx.beginPath();
                    this.ctx.moveTo(px, py);
                    this.ctx.lineTo(px + Math.cos(angle) * len, py + Math.sin(angle) * len);
                    this.ctx.stroke();
                }
            }
        });

        this.texture.needsUpdate = true;
    }

    getTexture() {
        return this.texture;
    }

    getCrackCount() {
        return this.cracks.length;
    }
}

faceData.forEach((data, index) => {
    // Each face gets its own material with unique crack texture
    const crackTexture = new CrackTexture(512);
    
    const faceMaterial = new THREE.MeshStandardMaterial({
        color: 0x000000,
        roughness: 0.35,
        metalness: 0.0,
        side: THREE.DoubleSide,
        alphaMap: crackTexture.getTexture(),
        transparent: true,
        alphaTest: 0.01, // Helps with sorting
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
    const duration = 600;
    
    function animatePieces() {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = Math.pow(progress, 2); // easeInQuad
        
        pieces.forEach((piece, i) => {
            const delay = i * 0.02;
            const pieceProgress = Math.max(0, (progress - delay) / (1 - delay));
            if (pieceProgress <= 0) return;
            
            const pieceEased = Math.pow(pieceProgress, 2);
            
            // Fly outward and rotate
            piece.position.x += piece.userData.velocity.x * pieceEased * 0.5;
            piece.position.y += piece.userData.velocity.y * pieceEased * 0.5;
            piece.position.z += piece.userData.velocity.z * pieceEased * 0.5;
            
            piece.rotation.x += piece.userData.angularVelocity.x * pieceEased;
            piece.rotation.y += piece.userData.angularVelocity.y * pieceEased;
            piece.rotation.z += piece.userData.angularVelocity.z * pieceEased;
            
            // Fade out
            piece.material.opacity = 1 - pieceEased;
            piece.material.transparent = true;
            piece.material.needsUpdate = true;
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
            face.material.alphaMap = crackTexture.getTexture(); // Restore original texture
            crackTexture.clear(); // Reset for potential reuse
            userData.clickCount = 0;
        }
    }
    
    // Hide original face immediately
    face.visible = false;
    animatePieces();
}

function createShatterPieces(face, crackTexture) {
    const pieces = [];
    const pieceCount = 12 + Math.floor(Math.random() * 8);
    
    // Get face world position and rotation
    const worldPos = new THREE.Vector3();
    const worldQuat = new THREE.Quaternion();
    face.getWorldPosition(worldPos);
    face.getWorldQuaternion(worldQuat);
    
    for (let i = 0; i < pieceCount; i++) {
        // Create irregular piece geometry (slightly randomized box)
        const size = 0.15 + Math.random() * 0.15;
        const geo = new THREE.BoxGeometry(size, size, 0.02);
        
        // Use face material but with crack texture
        const mat = face.material.clone();
        mat.alphaMap = crackTexture.getTexture();
        mat.transparent = true;
        mat.side = THREE.DoubleSide;
        mat.needsUpdate = true;
        
        const piece = new THREE.Mesh(geo, mat);
        
        // Position near face center with small offset
        const offset = new THREE.Vector3(
            (Math.random() - 0.5) * 0.8,
            (Math.random() - 0.5) * 0.8,
            0
        );
        offset.applyQuaternion(worldQuat);
        piece.position.copy(worldPos).add(offset);
        piece.quaternion.copy(worldQuat);
        
        // Random velocity outward
        const velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 0.02,
            (Math.random() - 0.5) * 0.02,
            (Math.random() - 0.5) * 0.01 - 0.005 // Slight backward
        );
        velocity.applyQuaternion(worldQuat);
        
        // Random angular velocity
        const angularVelocity = new THREE.Vector3(
            (Math.random() - 0.5) * 0.05,
            (Math.random() - 0.5) * 0.05,
            (Math.random() - 0.5) * 0.05
        );
        
        piece.userData = { velocity, angularVelocity };
        scene.add(piece);
        pieces.push(piece);
    }
    
    return pieces;
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

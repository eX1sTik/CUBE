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
const faceMaterial = new THREE.MeshStandardMaterial({
    color: 0x000000,
    roughness: 0.35,
    metalness: 0.0,
    side: THREE.DoubleSide, // Visible from both sides
});

faceData.forEach((data, index) => {
    const face = new THREE.Mesh(faceGeometry, faceMaterial);
    face.position.set(...data.pos);
    face.rotation.set(...data.rot);
    face.userData = { faceIndex: index, originalPosition: data.pos, originalRotation: data.rot };
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
    // Calculate mouse position in normalized device coordinates
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    // Raycast against face meshes only
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(faces.filter(f => f.visible), true);

    if (intersects.length > 0) {
        const hitFace = intersects[0].object;
        // Animate face disappearance
        animateFaceOut(hitFace);
    }
}

function animateFaceOut(face) {
    const startTime = performance.now();
    const duration = 300; // ms
    const startScale = 1;
    const targetScale = 0.01;
    const startOpacity = face.material.opacity !== undefined ? face.material.opacity : 1;

    function animate() {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic

        face.scale.setScalar(startScale + (targetScale - startScale) * eased);
        face.material.opacity = startOpacity * (1 - eased);
        face.material.transparent = true;
        face.material.needsUpdate = true;

        if (progress < 1) {
            requestAnimationFrame(animate);
        } else {
            face.visible = false;
            face.scale.setScalar(1);
            face.material.opacity = startOpacity;
            face.material.transparent = false;
        }
    }
    animate();
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

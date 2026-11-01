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

// Cube - black material with white specular highlights
const geometry = new THREE.BoxGeometry(2, 2, 2);
const material = new THREE.MeshStandardMaterial({
    color: 0x000000,        // Black base color
    roughness: 0.2,         // Low roughness for sharp highlights
    metalness: 0.1,         // Slight metalness for specular reflection
    envMapIntensity: 1.0,   // Environment map intensity
});
const cube = new THREE.Mesh(geometry, material);
scene.add(cube);

// Wireframe - subtle dark gray on white background
const edges = new THREE.EdgesGeometry(geometry);
const lineMaterial = new THREE.LineBasicMaterial({ 
    color: 0x333333, 
    transparent: true, 
    opacity: 0.4 
});
const wireframe = new THREE.LineSegments(edges, lineMaterial);
cube.add(wireframe);

// Lighting - white lights for white highlights on black cube
const ambientLight = new THREE.AmbientLight(0xffffff, 0.4); // Soft white ambient
scene.add(ambientLight);

// Main directional light - white, positioned for good highlights
const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
directionalLight.position.set(5, 10, 7);
scene.add(directionalLight);

// Fill light - softer white from opposite side
const fillLight = new THREE.DirectionalLight(0xffffff, 0.5);
fillLight.position.set(-5, 5, -7);
scene.add(fillLight);

// Rim light - white from behind for edge highlights
const rimLight = new THREE.DirectionalLight(0xffffff, 0.8);
rimLight.position.set(0, -5, -10);
scene.add(rimLight);

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
        
        // Schedule 4 beats ahead
        for (let i = 0; i < 4; i++) {
            const time = now + i * beatInterval;
            this.scheduleBeat(time, i % 4);
        }
        
        // Schedule next loop
        setTimeout(() => this.scheduleLoop(), beatInterval * 4 * 1000 * 0.95);
    }

    scheduleBeat(time, beatIndex) {
        // Kick - deep and minimal
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

        // Atmospheric pad - every 4 beats
        if (beatIndex === 0) {
            this.playPad(time);
        }

        // Subtle hi-hat on off-beats
        if (beatIndex % 2 === 1) {
            this.playHihat(time);
        }
    }

    playPad(time) {
        const frequencies = [65.41, 82.41, 98.00, 130.81]; // C2, E2, G2, C3
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

// Start audio on first interaction
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
    
    // Subtle cube rotation (in addition to orbit controls auto-rotate)
    cube.rotation.x += 0.0005;
    cube.rotation.y += 0.0008;
    
    // Pulse wireframe opacity slightly
    const time = performance.now() * 0.001;
    wireframe.material.opacity = 0.3 + Math.sin(time * 0.5) * 0.1;
    
    renderer.render(scene, camera);
}

animate();

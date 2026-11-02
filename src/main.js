import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TextureLoader } from 'three';
import { createDwarfCharacter, setupDwarfInteraction } from './character/DwarfCharacter.js';
import { initAudio, getAudioEngine } from './audio/AudioEngine.js';
import { createMetronome } from './rhythm/Metronome.js';

// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB); // Sky blue background

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 1.6, 5);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.enablePan = true;
controls.minDistance = 2;
controls.maxDistance = 10;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.15;
controls.target.set(0, 1.4, 0);

// Initialize audio and metronome
initAudio();
const audioEngine = getAudioEngine();
const metronome = createMetronome(audioEngine);

// Load dwarf character texture and create character
const textureLoader = new TextureLoader();
textureLoader.load(
    'assets/dwarf.jpg',
    (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.generateMipmaps = true;
        
        const dwarf = createDwarfCharacter(texture, scene, audioEngine);
        setupDwarfInteraction(dwarf, scene, camera, renderer, controls);
        
        // Add metronome visual elements to scene
        scene.add(metronome.getCircleGroup());
        metronome.start();
        
        // Start game loop
        animate();
    },
    (xhr) => {
        console.log(`Loading dwarf texture: ${(xhr.loaded / xhr.total * 100).toFixed(0)}%`);
    },
    (error) => {
        console.error('Error loading dwarf texture:', error);
        // Fallback: create procedural dwarf
        createProceduralDwarf();
    }
);

function createProceduralDwarf() {
    console.log('Creating procedural dwarf fallback...');
    // Create a simple colored dwarf as fallback
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    
    // Draw a simple dwarf face
    ctx.fillStyle = '#FFDBAC';
    ctx.fillRect(0, 0, 512, 512);
    
    // Beard
    ctx.fillStyle = '#8B4513';
    ctx.beginPath();
    ctx.ellipse(256, 380, 180, 120, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Face
    ctx.fillStyle = '#FFDBAC';
    ctx.beginPath();
    ctx.ellipse(256, 280, 140, 140, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Eyes
    ctx.fillStyle = '#2D1B0E';
    ctx.beginPath();
    ctx.arc(200, 260, 15, 0, Math.PI * 2);
    ctx.arc(312, 260, 15, 0, Math.PI * 2);
    ctx.fill();
    
    // Nose
    ctx.fillStyle = '#E0A080';
    ctx.beginPath();
    ctx.ellipse(256, 300, 25, 20, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Mouth
    ctx.strokeStyle = '#8B4513';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(256, 340, 30, 0, Math.PI);
    ctx.stroke();
    
    // Hat
    ctx.fillStyle = '#8B0000';
    ctx.beginPath();
    ctx.moveTo(100, 200);
    ctx.lineTo(256, 50);
    ctx.lineTo(412, 200);
    ctx.closePath();
    ctx.fill();
    
    // Hat brim
    ctx.fillStyle = '#660000';
    ctx.fillRect(80, 195, 352, 15);
    
    // Hat pompom
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(256, 45, 20, 0, Math.PI * 2);
    ctx.fill();
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    
    const dwarf = createDwarfCharacter(texture, scene, audioEngine);
    setupDwarfInteraction(dwarf, scene, camera, renderer, controls);
    
    scene.add(metronome.getCircleGroup());
    metronome.start();
    
    animate();
}

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
directionalLight.position.set(5, 10, 7);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 2048;
directionalLight.shadow.mapSize.height = 2048;
directionalLight.shadow.camera.near = 0.5;
directionalLight.shadow.camera.far = 20;
directionalLight.shadow.camera.left = -6;
directionalLight.shadow.camera.right = 6;
directionalLight.shadow.camera.top = 6;
directionalLight.shadow.camera.bottom = -6;
scene.add(directionalLight);

const fillLight = new THREE.DirectionalLight(0xfff0e0, 0.5);
fillLight.position.set(-5, 5, -7);
scene.add(fillLight);

const topLight = new THREE.DirectionalLight(0xffffee, 0.6);
topLight.position.set(0, 12, 0);
scene.add(topLight);

const rimLight = new THREE.DirectionalLight(0xffeecc, 0.4);
rimLight.position.set(0, 2, -10);
scene.add(rimLight);

// Ground plane for shadows
const groundGeo = new THREE.PlaneGeometry(30, 30);
const groundMat = new THREE.ShadowMaterial({ opacity: 0.2 });
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.2;
ground.receiveShadow = true;
scene.add(ground);

// Environment: simple tavern floor
const floorGeo = new THREE.CylinderGeometry(8, 8, 0.4, 32);
const floorMat = new THREE.MeshStandardMaterial({ 
    color: 0x5D4037,
    roughness: 0.9,
    metalness: 0.0
});
const floor = new THREE.Mesh(floorGeo, floorMat);
floor.position.y = -0.2;
floor.receiveShadow = true;
scene.add(floor);

// Resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Game state
let dwarf = null;
let lastTime = performance.now();

function animate() {
    requestAnimationFrame(animate);
    
    const now = performance.now();
    const deltaTime = (now - lastTime) / 1000;
    lastTime = now;
    
    controls.update();
    
    if (dwarf) {
        dwarf.update(deltaTime);
    }
    
    // Update bruise textures
    if (dwarf && dwarf.bruiseTextures) {
        Object.values(dwarf.bruiseTextures).forEach(texture => {
            texture.update(deltaTime * 1000);
        });
    }
    
    renderer.render(scene, camera);
}

// Make dwarf globally accessible for debugging
window.getDwarf = () => dwarf;

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createCube, setupCubeInteraction } from './cube/Cube.js';
import { initAudio, getAudioEngine } from './audio/AudioEngine.js';
import { createMetronome } from './rhythm/Metronome.js';
import { createWell } from './objects/Well.js';

// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xffffff); // White background

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 0, 6);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
document.body.appendChild(renderer.domElement);

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.enablePan = true;
controls.minDistance = 3;
controls.maxDistance = 15;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.3;
controls.target.set(0, 0, 0);

// Initialize audio on first user gesture
function initAudioOnGesture() {
    initAudio();
    window.removeEventListener('click', initAudioOnGesture);
    window.removeEventListener('keydown', initAudioOnGesture);
}
window.addEventListener('click', initAudioOnGesture, { once: true });
window.addEventListener('keydown', initAudioOnGesture, { once: true });

// Create audio engine and metronome
const audioEngine = getAudioEngine();
const metronome = createMetronome(audioEngine);

// Create cube with audio engine for rhythm system
const { cubeGroup, faces, faceWireframes, rhythmSystem } = createCube(scene, audioEngine);

// Well reference (created after cube destruction)
let well = null;

// Setup cube interaction with callback for when all faces destroyed
const { state } = setupCubeInteraction(faces, faceWireframes, scene, camera, renderer, controls, rhythmSystem, () => {
    console.log('=== ALL FACES DESTROYED - CREATING WELL ===');
    
    // All faces destroyed - create well at cube position
    const cubePosition = cubeGroup.position.clone();
    console.log('Cube position:', cubePosition);
    
    // Remove cube from scene
    scene.remove(cubeGroup);
    faces.forEach(face => {
        scene.remove(face);
        if (face.material.map) face.material.map.dispose();
        if (face.material.alphaMap) face.material.alphaMap.dispose();
        face.geometry.dispose();
        face.material.dispose();
    });
    faceWireframes.forEach(wf => {
        scene.remove(wf);
        wf.geometry.dispose();
        wf.material.dispose();
    });
    
    // Position well so its TOP RIM is at the cube's top (y=1 for a 2-unit cube centered at 0)
    // Well depth is 15, so center should be at y = 1 - 15/2 = -6.5
    const wellDepth = 15;
    const wellPosition = new THREE.Vector3(
        cubePosition.x,
        cubePosition.y + 1 - wellDepth / 2,  // Align well top with cube top
        cubePosition.z
    );
    
    console.log('Creating well at:', wellPosition);
    
    // Create well at adjusted position
    well = createWell(scene, {
        position: wellPosition,
        radius: 2.5,
        depth: wellDepth
    });
    
    console.log('Well created:', well);
    console.log('Well group position:', well.group.position);
    console.log('Well group world position:', well.getWorldPosition());
    
    // Stop cube auto-rotation
    controls.autoRotate = false;
    
    // Optional: animate camera to look into well
    // createWellPeekAnimation(camera, well);
});

// Add metronome visual elements to scene
scene.add(metronome.getCircleGroup());
metronome.start();

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);  // Brighter
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);  // Brighter
directionalLight.position.set(5, 10, 7);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 2048;
directionalLight.shadow.mapSize.height = 2048;
directionalLight.shadow.camera.near = 0.5;
directionalLight.shadow.camera.far = 30;  // Extended for well depth
directionalLight.shadow.camera.left = -10;
directionalLight.shadow.camera.right = 10;
directionalLight.shadow.camera.top = 10;
directionalLight.shadow.camera.bottom = -10;
scene.add(directionalLight);

const fillLight = new THREE.DirectionalLight(0x88aaff, 0.5);
fillLight.position.set(-5, 5, -7);
scene.add(fillLight);

const topLight = new THREE.DirectionalLight(0xffffee, 0.6);
topLight.position.set(0, 10, 0);
scene.add(topLight);

const rimLight1 = new THREE.DirectionalLight(0xff6600, 0.3);
rimLight1.position.set(0, -5, -10);
scene.add(rimLight1);

const rimLight2 = new THREE.DirectionalLight(0x00ffff, 0.3);
rimLight2.position.set(10, 0, 5);
scene.add(rimLight2);

// Ground plane for shadows
const groundGeo = new THREE.PlaneGeometry(20, 20);
const groundMat = new THREE.ShadowMaterial({ opacity: 0.15 });
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -2;
ground.receiveShadow = true;
scene.add(ground);

// Resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Animation loop
let lastTime = performance.now();
function animate() {
    requestAnimationFrame(animate);
    
    const now = performance.now();
    const deltaTime = (now - lastTime) / 1000; // seconds
    lastTime = now;
    
    controls.update();
    
    // Rotate cube slowly (only if still in cube phase)
    if (state.phase === 'cube') {
        cubeGroup.rotation.y += 0.001;
        cubeGroup.rotation.x += 0.0005;
    }
    
    // Update well animation if well exists
    if (well && well.update) {
        well.update(deltaTime);
    }
    
    renderer.render(scene, camera);
}

animate();

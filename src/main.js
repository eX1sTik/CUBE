import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createCharacter, setupCharacterInteraction } from './character/Character.js';
import { initAudio, getAudioEngine } from './audio/AudioEngine.js';
import { createMetronome } from './rhythm/Metronome.js';

// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf0f0f0);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 1.6, 4);

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
controls.maxDistance = 8;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.2;
controls.target.set(0, 1.5, 0);

// Initialize audio and metronome
initAudio();
const audioEngine = getAudioEngine();
const metronome = createMetronome(audioEngine);

// Load character
let character = null;
const loader = new GLTFLoader();
loader.load(
    'models/dwarf-halfling.glb',
    (gltf) => {
        character = createCharacter(gltf.scene, scene, audioEngine);
        setupCharacterInteraction(character, scene, camera, renderer, controls);
        
        // Add metronome visual elements to scene
        scene.add(metronome.getCircleGroup());
        metronome.start();
    },
    (xhr) => {
        console.log((xhr.loaded / xhr.total * 100) + '% loaded');
    },
    (error) => {
        console.error('Error loading character model:', error);
        // Fallback: create a simple placeholder character
        createPlaceholderCharacter();
    }
);

function createPlaceholderCharacter() {
    // Simple placeholder while model loads
    const group = new THREE.Group();
    
    // Body
    const bodyGeo = new THREE.CapsuleGeometry(0.4, 0.8, 8, 16);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.7 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 1.0;
    body.castShadow = true;
    group.add(body);
    
    // Head
    const headGeo = new THREE.SphereGeometry(0.35, 16, 16);
    const headMat = new THREE.MeshStandardMaterial({ color: 0xFFDBAC, roughness: 0.5 });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 1.7;
    head.castShadow = true;
    head.name = 'Head';
    group.add(head);
    
    // Left cheek marker
    const leftCheekGeo = new THREE.SphereGeometry(0.08, 8, 8);
    const cheekMat = new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.3 });
    const leftCheek = new THREE.Mesh(leftCheekGeo, cheekMat);
    leftCheek.position.set(-0.18, 1.75, 0.25);
    leftCheek.name = 'LeftCheek';
    group.add(leftCheek);
    
    // Right cheek marker
    const rightCheek = new THREE.Mesh(leftCheekGeo, cheekMat);
    rightCheek.position.set(0.18, 1.75, 0.25);
    rightCheek.name = 'RightCheek';
    group.add(rightCheek);
    
    // Nose
    const noseGeo = new THREE.SphereGeometry(0.06, 8, 8);
    const nose = new THREE.Mesh(noseGeo, new THREE.MeshStandardMaterial({ color: 0xE0A080 }));
    nose.position.set(0, 1.68, 0.32);
    group.add(nose);
    
    scene.add(group);
    character = createCharacter(group, scene, audioEngine);
    setupCharacterInteraction(character, scene, camera, renderer, controls);
    
    scene.add(metronome.getCircleGroup());
    metronome.start();
}

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(5, 10, 7);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 2048;
directionalLight.shadow.mapSize.height = 2048;
directionalLight.shadow.camera.near = 0.5;
directionalLight.shadow.camera.far = 20;
directionalLight.shadow.camera.left = -5;
directionalLight.shadow.camera.right = 5;
directionalLight.shadow.camera.top = 5;
directionalLight.shadow.camera.bottom = -5;
scene.add(directionalLight);

const fillLight = new THREE.DirectionalLight(0xffffff, 0.4);
fillLight.position.set(-5, 5, -7);
scene.add(fillLight);

const topLight = new THREE.DirectionalLight(0xffffff, 0.5);
topLight.position.set(0, 10, 0);
scene.add(topLight);

const sideLight1 = new THREE.DirectionalLight(0xffffff, 0.3);
sideLight1.position.set(10, 0, 5);
scene.add(sideLight1);

const sideLight2 = new THREE.DirectionalLight(0xffffff, 0.3);
sideLight2.position.set(-10, 0, -5);
scene.add(sideLight2);

// Ground plane for shadows
const groundGeo = new THREE.PlaneGeometry(20, 20);
const groundMat = new THREE.ShadowMaterial({ opacity: 0.15 });
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.1;
ground.receiveShadow = true;
scene.add(ground);

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
    
    if (character) {
        character.update();
    }
    
    const time = performance.now() * 0.001;
    
    renderer.render(scene, camera);
}

animate();

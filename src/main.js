import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createCube, setupCubeInteraction } from './cube/Cube.js';
import { initAudio } from './audio/AudioEngine.js';

// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xffffff);

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

// Create cube with interaction
const { cubeGroup, faces, faceWireframes } = createCube(scene);
setupCubeInteraction(faces, faceWireframes, scene, camera, renderer, controls);

// Lighting
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

// Audio
initAudio();

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
    
    cubeGroup.rotation.x += 0.0005;
    cubeGroup.rotation.y += 0.0008;
    
    const time = performance.now() * 0.001;
    faceWireframes.forEach(wf => {
        wf.material.opacity = 0.3 + Math.sin(time * 0.5) * 0.1;
    });
    
    renderer.render(scene, camera);
}

animate();

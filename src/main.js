import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three@0.160.0/examples/jsm/controls/OrbitControls.js';

// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xffffff);

// Camera setup
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 5;

// Renderer setup
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.getElementById('app').appendChild(renderer.domElement);

// Controls for rotation/interaction
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.enablePan = false;
controls.minDistance = 3;
controls.maxDistance = 10;

// Create cube geometry and material
const geometry = new THREE.BoxGeometry(2, 2, 2);
const material = new THREE.MeshStandardMaterial({ 
  color: 0x1a1a1a,
  roughness: 0.5,
  metalness: 0.2
});
const cube = new THREE.Mesh(geometry, material);
scene.add(cube);

// Add edge geometry for clear outline
const edgesGeometry = new THREE.EdgesGeometry(geometry);
const edgesMaterial = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 });
const edges = new THREE.LineSegments(edgesGeometry, edgesMaterial);
cube.add(edges);

// Add lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
directionalLight.position.set(5, 10, 7);
scene.add(directionalLight);

const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0xcccccc, 0.6);
scene.add(hemisphereLight);

const pointLight = new THREE.PointLight(0xffffff, 0.5);
pointLight.position.set(-3, 5, 3);
scene.add(pointLight);

// Handle window resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Animation loop
function animate() {
  requestAnimationFrame(animate);
  
  // Subtle auto-rotation to show 3D depth
  cube.rotation.x += 0.003;
  cube.rotation.y += 0.005;
  
  // Update controls
  controls.update();
  
  // Render scene
  renderer.render(scene, camera);
}

animate();

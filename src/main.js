import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// 1. Сцена и белый фон
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xffffff);

// 2. Камера
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 4;

// 3. Рендерер
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.getElementById('app').appendChild(renderer.domElement);

// 4. Управление мышкой (вращение)
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; // Плавность
controls.dampingFactor = 0.05;

// 5. Чёрный куб (используем очень тёмно-серый 0x111111, чтобы на белом фоне были видны грани)
const geometry = new THREE.BoxGeometry(2, 2, 2);
const material = new THREE.MeshStandardMaterial({ 
    color: 0x111111, 
    roughness: 0.4, 
    metalness: 0.1 
});
const cube = new THREE.Mesh(geometry, material);
scene.add(cube);

// Добавим чёрную обводку, чтобы куб был идеально виден как 3D-объект
const edges = new THREE.EdgesGeometry(geometry);
const lineMaterial = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 });
const wireframe = new THREE.LineSegments(edges, lineMaterial);
cube.add(wireframe);

// 6. Свет
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
dirLight.position.set(5, 5, 5);
scene.add(dirLight);

// 7. Адаптация под размер окна
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// 8. Анимация
function animate() {
    requestAnimationFrame(animate);
    
    // Медленное автовращение
    cube.rotation.x += 0.005;
    cube.rotation.y += 0.01;
    
    controls.update();
    renderer.render(scene, camera);
}

animate();

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ============ AUDIO SYSTEM ============
class AudioEngine {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.masterGain = this.ctx.createGain();
        this.masterGain.connect(this.ctx.destination);
        this.masterGain.gain.value = 0.3;
        this.isPlaying = false;
        this.currentTime = 0;
        this.bpm = 90;
        this.beatInterval = 60 / this.bpm;
        this.nextBeatTime = 0;
        this.onBeatCallbacks = [];
        this.scheduleAheadTime = 0.1;
        this.lookahead = 25;
        this.timerID = null;
    }

    resume() {
        if (this.ctx.state === 'suspended') this.ctx.resume();
    }

    start() {
        if (this.isPlaying) return;
        this.isPlaying = true;
        this.currentTime = this.ctx.currentTime;
        this.nextBeatTime = this.currentTime + 0.1;
        this.scheduler();
    }

    stop() {
        this.isPlaying = false;
        if (this.timerID) clearTimeout(this.timerID);
    }

    scheduler() {
        if (!this.isPlaying) return;
        this.timerID = setTimeout(() => this.scheduler(), this.lookahead);
        
        while (this.nextBeatTime < this.ctx.currentTime + this.scheduleAheadTime) {
            this.scheduleBeat(this.nextBeatTime);
            this.nextBeatTime += this.beatInterval;
        }
    }

    scheduleBeat(time) {
        // Kick drum
        const kick = this.ctx.createOscillator();
        const kickGain = this.ctx.createGain();
        kick.connect(kickGain);
        kickGain.connect(this.masterGain);
        kick.frequency.setValueAtTime(150, time);
        kick.frequency.exponentialRampToValueAtTime(0.01, time + 0.5);
        kickGain.gain.setValueAtTime(1, time);
        kickGain.gain.exponentialRampToValueAtTime(0.01, time + 0.5);
        kick.start(time);
        kick.stop(time + 0.5);

        // Ambient pad (every 4 beats)
        if (Math.floor(this.currentTime / this.beatInterval) % 4 === 0) {
            this.playPad(time);
        }

        // Hi-hat (off-beats)
        if (Math.floor(this.currentTime / this.beatInterval) % 2 === 1) {
            this.playHihat(time);
        }

        // Trigger callbacks
        this.onBeatCallbacks.forEach(cb => cb(time));
        this.currentTime = time;
    }

    playPad(time) {
        const frequencies = [130.81, 164.81, 196.00, 220.00]; // C3, E3, G3, A3
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
            filter.frequency.value = 800;
            filter.Q.value = 2;
            gain.gain.setValueAtTime(0, time);
            gain.gain.linearRampToValueAtTime(0.15, time + 0.5);
            gain.gain.exponentialRampToValueAtTime(0.01, time + 4);
            osc.start(time);
            osc.stop(time + 4);
        });
    }

    playHihat(time) {
        const noise = this.ctx.createBufferSource();
        const bufferSize = this.ctx.sampleRate * 0.1;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
        noise.buffer = buffer;
        
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        filter.type = 'highpass';
        filter.frequency.value = 8000;
        gain.gain.setValueAtTime(0.05, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.1);
        noise.start(time);
        noise.stop(time + 0.1);
    }

    onBeat(callback) {
        this.onBeatCallbacks.push(callback);
    }

    getBeatProgress() {
        const elapsed = (this.ctx.currentTime - this.currentTime) % this.beatInterval;
        return elapsed / this.beatInterval;
    }
}

// ============ CUBE DESTRUCTION SYSTEM ============
class DestructibleCube {
    constructor(scene) {
        this.scene = scene;
        this.faces = [];
        this.isDestroying = false;
        this.destroyProgress = 0;
        this.clickCount = 0;
        this.requiredClicks = 8;
        this.lastClickTime = 0;
        this.perfectClickWindow = 0.15; // seconds around beat
        
        this.createCube();
    }

    createCube() {
        const size = 2;
        const half = size / 2;
        const faceData = [
            { pos: [0, 0, half], rot: [0, 0, 0], normal: [0, 0, 1] },      // Front
            { pos: [0, 0, -half], rot: [0, Math.PI, 0], normal: [0, 0, -1] }, // Back
            { pos: [half, 0, 0], rot: [0, -Math.PI/2, 0], normal: [1, 0, 0] }, // Right
            { pos: [-half, 0, 0], rot: [0, Math.PI/2, 0], normal: [-1, 0, 0] }, // Left
            { pos: [0, half, 0], rot: [-Math.PI/2, 0, 0], normal: [0, 1, 0] },  // Top
            { pos: [0, -half, 0], rot: [Math.PI/2, 0, 0], normal: [0, -1, 0] }, // Bottom
        ];

        faceData.forEach((data, i) => {
            const geometry = new THREE.PlaneGeometry(size, size, 10, 10);
            const material = new THREE.MeshStandardMaterial({
                color: 0x111111,
                roughness: 0.4,
                metalness: 0.1,
                side: THREE.DoubleSide,
                transparent: true,
                opacity: 1
            });
            const face = new THREE.Mesh(geometry, material);
            face.position.set(...data.pos);
            face.rotation.set(...data.rot);
            face.userData = {
                originalPos: new THREE.Vector3(...data.pos),
                originalRot: new THREE.Euler(...data.rot),
                normal: new THREE.Vector3(...data.normal),
                index: i,
                delay: i * 0.1
            };
            this.scene.add(face);
            this.faces.push(face);

            // Add edges for each face
            const edges = new THREE.EdgesGeometry(geometry);
            const lineMat = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 1 });
            const wire = new THREE.LineSegments(edges, lineMat);
            wire.position.set(...data.pos);
            wire.rotation.set(...data.rot);
            face.add(wire);
            face.userData.wireframe = wire;
        });
    }

    checkClick(raycaster, camera) {
        const intersects = raycaster.intersectObjects(this.faces, true);
        if (intersects.length > 0) {
            const face = intersects[0].object;
            if (face.userData.index !== undefined) {
                this.handleFaceClick(face);
                return true;
            }
        }
        return false;
    }

    handleFaceClick(face) {
        const now = performance.now() / 1000;
        const beatProgress = audioEngine.getBeatProgress();
        const isOnBeat = beatProgress < this.perfectClickWindow || beatProgress > (1 - this.perfectClickWindow);
        
        if (isOnBeat) {
            this.clickCount++;
            this.triggerFaceExplosion(face);
            
            // Visual feedback for perfect click
            this.showClickFeedback(face, true);
            
            if (this.clickCount >= this.requiredClicks) {
                this.startFullDestruction();
            }
        } else {
            // Missed beat - slight penalty
            this.showClickFeedback(face, false);
        }
        this.lastClickTime = now;
    }

    triggerFaceExplosion(face) {
        const userData = face.userData;
        const direction = userData.normal.clone();
        
        // Animate face flying off
        const duration = 1.5;
        const startPos = face.position.clone();
        const startRot = face.rotation.clone();
        const targetPos = startPos.clone().add(direction.multiplyScalar(10));
        const targetRot = new THREE.Euler(
            startRot.x + (Math.random() - 0.5) * 10,
            startRot.y + (Math.random() - 0.5) * 10,
            startRot.z + (Math.random() - 0.5) * 10
        );
        
        const startTime = performance.now() / 1000;
        const animateFace = () => {
            const elapsed = (performance.now() / 1000) - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = this.easeOutCubic(progress);
            
            face.position.lerpVectors(startPos, targetPos, eased);
            face.rotation.x = THREE.MathUtils.lerp(startRot.x, targetRot.x, eased);
            face.rotation.y = THREE.MathUtils.lerp(startRot.y, targetRot.y, eased);
            face.rotation.z = THREE.MathUtils.lerp(startRot.z, targetRot.z, eased);
            
            // Fade out
            face.material.opacity = 1 - eased;
            if (face.userData.wireframe) {
                face.userData.wireframe.material.opacity = 1 - eased;
            }
            
            if (progress < 1) {
                requestAnimationFrame(animateFace);
            } else {
                this.scene.remove(face);
                this.faces = this.faces.filter(f => f !== face);
            }
        };
        animateFace();
        
        // Particle burst
        this.createParticles(face.position.clone(), direction);
    }

    startFullDestruction() {
        this.isDestroying = true;
        this.faces.forEach((face, i) => {
            setTimeout(() => {
                if (this.scene.children.includes(face)) {
                    this.triggerFaceExplosion(face);
                }
            }, i * 100);
        });
        
        // Reset after destruction
        setTimeout(() => {
            this.resetCube();
        }, 3000);
    }

    resetCube() {
        this.faces.forEach(face => this.scene.remove(face));
        this.faces = [];
        this.clickCount = 0;
        this.isDestroying = false;
        this.createCube();
    }

    createParticles(position, direction) {
        const particleCount = 20;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        const velocities = [];
        const colors = new Float32Array(particleCount * 3);
        
        for (let i = 0; i < particleCount; i++) {
            positions[i * 3] = position.x;
            positions[i * 3 + 1] = position.y;
            positions[i * 3 + 2] = position.z;
            
            const spread = new THREE.Vector3(
                (Math.random() - 0.5) * 2,
                (Math.random() - 0.5) * 2,
                (Math.random() - 0.5) * 2
            ).add(direction.clone().multiplyScalar(2)).normalize().multiplyScalar(0.1 + Math.random() * 0.2);
            velocities.push(spread);
            
            colors[i * 3] = 0.1;
            colors[i * 3 + 1] = 0.1;
            colors[i * 3 + 2] = 0.1;
        }
        
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        
        const material = new THREE.PointsMaterial({
            size: 0.05,
            vertexColors: true,
            transparent: true,
            opacity: 1,
            sizeAttenuation: true
        });
        
        const particles = new THREE.Points(geometry, material);
        this.scene.add(particles);
        
        const startTime = performance.now() / 1000;
        const duration = 1.5;
        
        const animateParticles = () => {
            const elapsed = (performance.now() / 1000) - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            const posAttr = geometry.getAttribute('position');
            for (let i = 0; i < particleCount; i++) {
                posAttr.setXYZ(i,
                    posAttr.getX(i) + velocities[i].x,
                    posAttr.getY(i) + velocities[i].y,
                    posAttr.getZ(i) + velocities[i].z
                );
                velocities[i].y -= 0.005; // gravity
            }
            posAttr.needsUpdate = true;
            material.opacity = 1 - progress;
            material.size = 0.05 * (1 - progress * 0.5);
            
            if (progress < 1) {
                requestAnimationFrame(animateParticles);
            } else {
                this.scene.remove(particles);
                geometry.dispose();
                material.dispose();
            }
        };
        animateParticles();
    }

    showClickFeedback(face, success) {
        const originalColor = face.material.color.clone();
        const flashColor = success ? new THREE.Color(0x00ff00) : new THREE.Color(0xff0000);
        face.material.color.set(flashColor);
        if (face.userData.wireframe) face.userData.wireframe.material.color.set(flashColor);
        
        setTimeout(() => {
            face.material.color.set(originalColor);
            if (face.userData.wireframe) face.userData.wireframe.material.color.set(0x000000);
        }, 100);
    }

    easeOutCubic(t) {
        return 1 - Math.pow(1 - t, 3);
    }

    update() {
        // Subtle breathing animation when not destroying
        if (!this.isDestroying) {
            const time = performance.now() / 1000;
            this.faces.forEach((face, i) => {
                const offset = Math.sin(time * 0.5 + i) * 0.02;
                face.position.addScaledVector(face.userData.normal, offset - face.userData.lastOffset || 0);
                face.userData.lastOffset = offset;
            });
        }
    }
}

// ============ MAIN GAME ============
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
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.minDistance = 3;
controls.maxDistance = 10;

// 5. Свет
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
dirLight.position.set(5, 5, 5);
scene.add(dirLight);

const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0xcccccc, 0.4);
scene.add(hemisphereLight);

// 6. Audio Engine
const audioEngine = new AudioEngine();

// 7. Destructible Cube
const cube = new DestructibleCube(scene);

// 8. Raycaster for interaction
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// 9. UI Elements
const uiContainer = document.createElement('div');
uiContainer.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    color: #333;
    font-family: monospace;
    text-align: center;
    pointer-events: none;
    z-index: 100;
`;
uiContainer.innerHTML = `
    <div id="beatIndicator" style="font-size: 24px; font-weight: bold; margin-bottom: 10px;">●</div>
    <div id="clickCounter" style="font-size: 14px;">Clicks: 0 / 8</div>
    <div id="instruction" style="font-size: 12px; opacity: 0.7; margin-top: 10px;">Click cube ON THE BEAT to destroy it</div>
`;
document.body.appendChild(uiContainer);

const beatIndicator = document.getElementById('beatIndicator');
const clickCounter = document.getElementById('clickCounter');

// 10. Event Listeners
function onMouseMove(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
}

function onClick(event) {
    audioEngine.resume();
    if (!audioEngine.isPlaying) audioEngine.start();
    
    raycaster.setFromCamera(mouse, camera);
    cube.checkClick(raycaster, camera);
}

window.addEventListener('mousemove', onMouseMove);
window.addEventListener('click', onClick);

// Touch support
window.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
        const touch = e.touches[0];
        mouse.x = (touch.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(touch.clientY / window.innerHeight) * 2 + 1;
        audioEngine.resume();
        if (!audioEngine.isPlaying) audioEngine.start();
        raycaster.setFromCamera(mouse, camera);
        cube.checkClick(raycaster, camera);
    }
}, { passive: true });

// 11. Window Resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// 12. Beat Visualization
audioEngine.onBeat((time) => {
    beatIndicator.style.transform = 'scale(1.5)';
    beatIndicator.style.color = '#000';
    setTimeout(() => {
        beatIndicator.style.transform = 'scale(1)';
        beatIndicator.style.color = '#333';
    }, 100);
});

// 13. Animation Loop
function animate() {
    requestAnimationFrame(animate);
    
    // Update cube
    cube.update();
    
    // Update UI
    clickCounter.textContent = `Clicks: ${cube.clickCount} / ${cube.requiredClicks}`;
    
    // Beat indicator pulse
    const progress = audioEngine.getBeatProgress();
    const pulseScale = 1 + Math.sin(progress * Math.PI * 2) * 0.3;
    beatIndicator.style.transform = `scale(${pulseScale})`;
    beatIndicator.style.opacity = 0.5 + 0.5 * Math.sin(progress * Math.PI * 2);
    
    // Auto-rotation (slower)
    cube.faces.forEach(face => {
        face.rotation.x += 0.0005;
        face.rotation.y += 0.001;
    });
    
    controls.update();
    renderer.render(scene, camera);
}

// Start audio on first interaction
document.body.addEventListener('click', () => {
    audioEngine.resume();
    if (!audioEngine.isPlaying) audioEngine.start();
}, { once: true });

animate();

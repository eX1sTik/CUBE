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

// Crack texture generator - produces visible cracks on ANY background
class CrackTexture {
    constructor(size = 512) {
        this.size = size;
        
        // Visible texture: dual-layer for visibility on both black and white backgrounds
        this.visibleCanvas = document.createElement('canvas');
        this.visibleCanvas.width = size;
        this.visibleCanvas.height = size;
        this.visibleCtx = this.visibleCanvas.getContext('2d');
        this.visibleTexture = new THREE.CanvasTexture(this.visibleCanvas);
        this.visibleTexture.wrapS = THREE.ClampToEdgeWrapping;
        this.visibleTexture.wrapT = THREE.ClampToEdgeWrapping;
        
        // Alpha texture: for shatter pieces
        this.alphaCanvas = document.createElement('canvas');
        this.alphaCanvas.width = size;
        this.alphaCanvas.height = size;
        this.alphaCtx = this.alphaCanvas.getContext('2d');
        this.alphaTexture = new THREE.CanvasTexture(this.alphaCanvas);
        this.alphaTexture.wrapS = THREE.ClampToEdgeWrapping;
        this.alphaTexture.wrapT = THREE.ClampToEdgeWrapping;
        
        this.cracks = []; // Array of crack paths
        this.impactPoints = []; // Impact centers
        this.clear();
    }

    clear() {
        // Base: transparent black (neutral)
        this.visibleCtx.fillStyle = '#000000';
        this.visibleCtx.fillRect(0, 0, this.size, this.size);
        
        this.alphaCtx.fillStyle = 'white';
        this.alphaCtx.fillRect(0, 0, this.size, this.size);
        
        this.cracks = [];
        this.impactPoints = [];
        this.updateTextures();
    }

    addImpact(x, y) {
        this.impactPoints.push({ x, y });
    }

    // Generate windshield-style cracks from impact point
    generateWindshieldCracks(impactX, impactY, severity) {
        const newCracks = [];
        
        // Radial cracks (spokes from impact)
        const radialCount = 3 + severity * 2; // 3, 5, 7, 9
        for (let i = 0; i < radialCount; i++) {
            const baseAngle = (i / radialCount) * Math.PI * 2;
            const angleVariation = (Math.random() - 0.5) * (Math.PI / radialCount) * 0.5;
            const angle = baseAngle + angleVariation;
            
            const path = this.generateRadialCrack(impactX, impactY, angle, severity);
            if (path.length > 1) newCracks.push(path);
            
            // Secondary branch
            if (Math.random() < 0.3 && severity > 0) {
                const branchAngle = angle + (Math.random() - 0.5) * 0.8;
                const branchPath = this.generateRadialCrack(impactX, impactY, branchAngle, severity - 0.5, 0.5);
                if (branchPath.length > 1) newCracks.push(branchPath);
            }
        }
        
        // Concentric rings (circular cracks)
        const ringCount = severity;
        for (let r = 0; r < ringCount; r++) {
            const radius = 20 + r * 30 + severity * 15 + Math.random() * 10;
            const ringCracks = this.generateConcentricRing(impactX, impactY, radius, severity);
            newCracks.push(...ringCracks);
        }
        
        // Impact chips
        for (let i = 0; i < 2 + severity; i++) {
            const chipAngle = Math.random() * Math.PI * 2;
            const chipDist = Math.random() * 8;
            const chipX = impactX + Math.cos(chipAngle) * chipDist;
            const chipY = impactY + Math.sin(chipAngle) * chipDist;
            const chipPath = this.generateChipCrack(chipX, chipY);
            if (chipPath.length > 1) newCracks.push(chipPath);
        }
        
        this.cracks.push(...newCracks);
    }

    generateRadialCrack(cx, cy, angle, severity, lengthMult = 1.0) {
        const path = [{ x: cx, y: cy }];
        const maxLength = (80 + severity * 60) * lengthMult;
        let x = cx, y = cy;
        let currentAngle = angle;
        let traveled = 0;
        
        while (traveled < maxLength) {
            const step = 8 + Math.random() * 15;
            const angleJitter = (Math.random() - 0.5) * 0.5 * (1 + severity * 0.3);
            currentAngle += angleJitter;
            
            x += Math.cos(currentAngle) * step;
            y += Math.sin(currentAngle) * step;
            traveled += step;
            
            // Bounce off edges
            if (x < 0) { x = Math.abs(x); currentAngle = Math.PI - currentAngle; }
            if (x > this.size) { x = 2 * this.size - x; currentAngle = Math.PI - currentAngle; }
            if (y < 0) { y = Math.abs(y); currentAngle = -currentAngle; }
            if (y > this.size) { y = 2 * this.size - y; currentAngle = -currentAngle; }
            
            path.push({ x, y });
            
            // Branching
            if (Math.random() < 0.1 * (1 + severity) && traveled > 20) {
                const branchAngle = currentAngle + (Math.random() > 0.5 ? 1 : -1) * (Math.PI/2.5 + Math.random() * Math.PI/2.5);
                const branchLength = 15 + Math.random() * 25 * (0.5 + severity * 0.3);
                const bx = x + Math.cos(branchAngle) * branchLength;
                const by = y + Math.sin(branchAngle) * branchLength;
                this.cracks.push([{ x, y }, { x: bx, y: by }]);
            }
            
            if (x < 10 || x > this.size - 10 || y < 10 || y > this.size - 10) break;
        }
        return path;
    }

    generateConcentricRing(cx, cy, radius, severity) {
        const cracks = [];
        const segments = 6 + Math.floor(severity * 2) + Math.floor(radius / 15);
        
        for (let i = 0; i < segments; i++) {
            const startAngle = (i / segments) * Math.PI * 2;
            const endAngle = ((i + 0.7 + Math.random() * 0.3) / segments) * Math.PI * 2;
            
            if (Math.random() < 0.6 + severity * 0.1) {
                const path = [];
                const steps = 4 + Math.floor((endAngle - startAngle) * 8);
                
                for (let s = 0; s <= steps; s++) {
                    const a = startAngle + (endAngle - startAngle) * (s / steps);
                    const r = radius + (Math.random() - 0.5) * 6 * (1 + severity * 0.4);
                    const x = cx + Math.cos(a) * r;
                    const y = cy + Math.sin(a) * r;
                    
                    if (x > 5 && x < this.size - 5 && y > 5 && y < this.size - 5) {
                        path.push({ x, y });
                    }
                }
                if (path.length > 2) cracks.push(path);
            }
        }
        return cracks;
    }

    generateChipCrack(cx, cy) {
        const path = [{ x: cx, y: cy }];
        const angle = Math.random() * Math.PI * 2;
        const length = 5 + Math.random() * 15;
        const x = cx + Math.cos(angle) * length;
        const y = cy + Math.sin(angle) * length;
        path.push({ x, y });
        return path;
    }

    addCracks(severity, impactX, impactY) {
        const severityLevel = Math.min(severity, 4) - 1; // 0, 1, 2, 3
        if (impactX !== undefined && impactY !== undefined) {
            this.addImpact(impactX, impactY);
            this.generateWindshieldCracks(impactX, impactY, severityLevel);
        }
        this.redraw();
    }

    redraw() {
        // Clear
        this.visibleCtx.fillStyle = '#000000';
        this.visibleCtx.fillRect(0, 0, this.size, this.size);
        this.alphaCtx.fillStyle = 'white';
        this.alphaCtx.fillRect(0, 0, this.size, this.size);

        // Draw all cracks with DUAL-TONE rendering for universal visibility
        // Each crack gets: DARK core (visible on white) + BRIGHT highlight (visible on black)
        this.cracks.forEach((path, pathIndex) => {
            if (path.length < 2) return;
            
            const isMain = pathIndex < this.cracks.length * 0.4;
            const baseWidth = isMain ? 2.5 : 1.5;
            
            // LAYER 1: Dark core - visible on WHITE background
            this.visibleCtx.strokeStyle = '#000000';
            this.visibleCtx.lineWidth = baseWidth + 1;
            this.visibleCtx.lineCap = 'round';
            this.visibleCtx.lineJoin = 'round';
            this.visibleCtx.shadowColor = 'rgba(0,0,0,0.5)';
            this.visibleCtx.shadowBlur = 2;
            this.drawPath(this.visibleCtx, path);
            this.visibleCtx.shadowBlur = 0;
            
            // LAYER 2: Bright refraction highlight - visible on BLACK background
            this.visibleCtx.strokeStyle = '#ffffff';
            this.visibleCtx.lineWidth = baseWidth * 0.4;
            this.visibleCtx.globalCompositeOperation = 'screen';
            this.drawPath(this.visibleCtx, path);
            this.visibleCtx.globalCompositeOperation = 'source-over';
            
            // LAYER 3: Mid-tone glass distortion body
            this.visibleCtx.strokeStyle = '#444444';
            this.visibleCtx.lineWidth = baseWidth * 0.8;
            this.visibleCtx.globalCompositeOperation = 'overlay';
            this.drawPath(this.visibleCtx, path);
            this.visibleCtx.globalCompositeOperation = 'source-over';
            
            // LAYER 4: Fine bright edge highlight
            this.visibleCtx.strokeStyle = '#aaaaaa';
            this.visibleCtx.lineWidth = baseWidth * 0.15;
            this.drawPath(this.visibleCtx, path);

            // ALPHA TEXTURE: For shatter transparency
            this.alphaCtx.strokeStyle = 'black';
            this.alphaCtx.lineWidth = baseWidth + 2;
            this.alphaCtx.lineCap = 'round';
            this.alphaCtx.lineJoin = 'round';
            this.drawPath(this.alphaCtx, path);
        });

        // Draw impact points (bullseye chips)
        this.impactPoints.forEach(pt => {
            // Dark center with bright ring
            const grad = this.visibleCtx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, 6);
            grad.addColorStop(0, '#000000');
            grad.addColorStop(0.5, '#222222');
            grad.addColorStop(1, '#000000');
            this.visibleCtx.fillStyle = grad;
            this.visibleCtx.beginPath();
            this.visibleCtx.arc(pt.x, pt.y, 6, 0, Math.PI * 2);
            this.visibleCtx.fill();
            
            // Bright ring
            this.visibleCtx.strokeStyle = '#ffffff';
            this.visibleCtx.lineWidth = 1.5;
            this.visibleCtx.globalCompositeOperation = 'screen';
            this.visibleCtx.beginPath();
            this.visibleCtx.arc(pt.x, pt.y, 5, 0, Math.PI * 2);
            this.visibleCtx.stroke();
            this.visibleCtx.globalCompositeOperation = 'source-over';
            
            // Alpha: hole
            this.alphaCtx.fillStyle = 'black';
            this.alphaCtx.beginPath();
            this.alphaCtx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
            this.alphaCtx.fill();
        });

        this.updateTextures();
    }

    drawPath(ctx, path) {
        if (path.length < 2) return;
        ctx.beginPath();
        ctx.moveTo(path[0].x, path[0].y);
        for (let i = 1; i < path.length; i++) {
            const xc = (path[i-1].x + path[i].x) / 2;
            const yc = (path[i-1].y + path[i].y) / 2;
            ctx.quadraticCurveTo(path[i-1].x, path[i-1].y, xc, yc);
        }
        if (path.length > 1) {
            const last = path[path.length - 1];
            const prev = path[path.length - 2];
            ctx.quadraticCurveTo(prev.x, prev.y, last.x, last.y);
        }
        ctx.stroke();
    }

    updateTextures() {
        this.visibleTexture.needsUpdate = true;
        this.alphaTexture.needsUpdate = true;
    }

    getVisibleTexture() {
        return this.visibleTexture;
    }

    getAlphaTexture() {
        return this.alphaTexture;
    }
}

faceData.forEach((data, index) => {
    const crackTexture = new CrackTexture(512);
    
    const faceMaterial = new THREE.MeshStandardMaterial({
        color: 0x000000,
        roughness: 0.35,
        metalness: 0.0,
        side: THREE.DoubleSide,
        map: crackTexture.getVisibleTexture(),
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
        const hit = intersects[0];
        const hitFace = hit.object;
        const uv = hit.uv;
        
        // Convert UV to texture coordinates
        const texX = uv.x * 512;
        const texY = (1 - uv.y) * 512; // Flip Y for canvas
        
        handleFaceClick(hitFace, texX, texY);
    }
}

function handleFaceClick(face, texX, texY) {
    const userData = face.userData;
    userData.clickCount++;
    
    // Each click adds windshield-style cracks at impact point
    const severity = userData.clickCount;
    userData.crackTexture.addCracks(severity, texX, texY);
    
    createImpactFlash(face, texX, texY);
    
    if (userData.clickCount >= userData.maxClicks) {
        animateFaceShatter(face);
    }
}

function createImpactFlash(face, texX, texY) {
    const flashGeo = new THREE.RingGeometry(0.01, 0.15, 32);
    const flashMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.8,
        side: THREE.DoubleSide,
        depthWrite: false,
    });
    const flash = new THREE.Mesh(flashGeo, flashMat);
    
    const worldPos = new THREE.Vector3();
    const worldNormal = new THREE.Vector3();
    face.getWorldPosition(worldPos);
    face.getWorldDirection(worldNormal);
    flash.position.copy(worldPos).addScaledVector(worldNormal, 0.011);
    flash.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), worldNormal);
    
    scene.add(flash);
    
    const startTime = performance.now();
    const duration = 150;
    
    function animateFlash() {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        
        flash.material.opacity = 0.8 * (1 - eased);
        flash.scale.setScalar(1 + eased * 3);
        
        if (progress < 1) {
            requestAnimationFrame(animateFlash);
        } else {
            scene.remove(flash);
            flash.geometry.dispose();
            flash.material.dispose();
        }
    }
    animateFlash();
}

function animateFaceShatter(face) {
    const userData = face.userData;
    const crackTexture = userData.crackTexture;
    const faceIndex = userData.faceIndex;
    
    const pieces = createShatterPieces(face, crackTexture);
    
    const startTime = performance.now();
    const duration = 1200;
    
    function animatePieces() {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        
        pieces.forEach((piece, i) => {
            const delay = i * 0.008;
            const pieceProgress = Math.max(0, (progress - delay) / (1 - delay));
            if (pieceProgress <= 0) return;
            
            const pieceEased = 1 - Math.pow(1 - pieceProgress, 3);
            
            piece.position.x += piece.userData.velocity.x * pieceEased;
            piece.position.y += piece.userData.velocity.y * pieceEased;
            piece.position.z += piece.userData.velocity.z * pieceEased;
            
            piece.userData.velocity.y -= 0.0008 * pieceEased;
            piece.userData.velocity.multiplyScalar(0.995);
            
            piece.rotation.x += piece.userData.angularVelocity.x;
            piece.rotation.y += piece.userData.angularVelocity.y;
            piece.rotation.z += piece.userData.angularVelocity.z;
            
            if (pieceProgress > 0.7) {
                piece.material.opacity = 1 - (pieceProgress - 0.7) / 0.3;
                piece.material.transparent = true;
                piece.material.needsUpdate = true;
            }
        });
        
        if (progress < 1) {
            requestAnimationFrame(animatePieces);
        } else {
            pieces.forEach(piece => {
                scene.remove(piece);
                piece.geometry.dispose();
                piece.material.dispose();
            });
            face.visible = false;
            crackTexture.clear();
            userData.clickCount = 0;
        }
    }
    
    face.visible = false;
    animatePieces();
}

function createShatterPieces(face, crackTexture) {
    const pieces = [];
    const pieceCount = 25 + Math.floor(Math.random() * 15);
    
    const worldPos = new THREE.Vector3();
    const worldQuat = new THREE.Quaternion();
    face.getWorldPosition(worldPos);
    face.getWorldQuaternion(worldQuat);
    
    const faceNormal = new THREE.Vector3(0, 0, 1).applyQuaternion(worldQuat);
    
    for (let i = 0; i < pieceCount; i++) {
        const geo = createShardGeometry();
        
        const mat = new THREE.MeshStandardMaterial({
            color: 0x000000,
            roughness: 0.35,
            metalness: 0.0,
            side: THREE.DoubleSide,
            map: crackTexture.getVisibleTexture(),
            alphaMap: crackTexture.getAlphaTexture(),
            transparent: true,
            alphaTest: 0.01,
        });
        mat.needsUpdate = true;
        
        const piece = new THREE.Mesh(geo, mat);
        
        const offset = new THREE.Vector3(
            (Math.random() - 0.5) * 1.5,
            (Math.random() - 0.5) * 1.5,
            (Math.random() - 0.5) * 0.2
        );
        offset.applyQuaternion(worldQuat);
        piece.position.copy(worldPos).add(offset);
        
        piece.rotation.set(
            Math.random() * Math.PI * 2,
            Math.random() * Math.PI * 2,
            Math.random() * Math.PI * 2
        );
        
        const outwardDir = new THREE.Vector3(
            (Math.random() - 0.5) * 2,
            (Math.random() - 0.5) * 2,
            (Math.random() - 0.5) * 2
        ).normalize();
        
        const explosionForce = 0.08 + Math.random() * 0.12;
        const velocity = outwardDir.multiplyScalar(explosionForce);
        velocity.addScaledVector(faceNormal, (Math.random() - 0.5) * 0.15);
        
        const angularVelocity = new THREE.Vector3(
            (Math.random() - 0.5) * 0.15,
            (Math.random() - 0.5) * 0.15,
            (Math.random() - 0.5) * 0.15
        );
        
        piece.userData = { 
            velocity, 
            angularVelocity,
            gravityMultiplier: 0.5 + Math.random() * 1.5,
            spinDecay: 0.98 + Math.random() * 0.015
        };
        
        scene.add(piece);
        pieces.push(piece);
    }
    
    return pieces;
}

function createShardGeometry() {
    const shapeType = Math.random();
    
    if (shapeType < 0.3) {
        const width = 0.08 + Math.random() * 0.25;
        const height = 0.08 + Math.random() * 0.25;
        const depth = 0.01 + Math.random() * 0.02;
        const geo = new THREE.BoxGeometry(width, height, depth);
        distortGeometry(geo, 0.15);
        return geo;
    } else if (shapeType < 0.55) {
        const size = 0.1 + Math.random() * 0.2;
        const geo = new THREE.BufferGeometry();
        const vertices = new Float32Array([
            0, size * 0.5, 0,
            -size * 0.5, -size * 0.5, 0,
            size * 0.5, -size * 0.5, 0,
            0, size * 0.5, -0.02,
            size * 0.5, -size * 0.5, -0.02,
            -size * 0.5, -size * 0.5, -0.02,
        ]);
        const indices = [
            0, 1, 2, 3, 4, 5, 0, 2, 4, 4, 1, 0, 1, 4, 5, 5, 2, 1, 2, 5, 3, 3, 0, 2,
        ];
        geo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
        geo.setIndex(indices);
        geo.computeVertexNormals();
        distortGeometry(geo, 0.2);
        return geo;
    } else if (shapeType < 0.75) {
        const length = 0.15 + Math.random() * 0.3;
        const width = 0.03 + Math.random() * 0.04;
        const depth = 0.01 + Math.random() * 0.015;
        const geo = new THREE.BoxGeometry(width, length, depth);
        distortGeometry(geo, 0.25);
        return geo;
    } else {
        const size = 0.12 + Math.random() * 0.18;
        const geo = new THREE.BoxGeometry(size, size, 0.02 + Math.random() * 0.03);
        distortGeometry(geo, 0.3);
        return geo;
    }
}

function distortGeometry(geometry, amount) {
    const position = geometry.attributes.position;
    for (let i = 0; i < position.count; i++) {
        const x = position.getX(i);
        const y = position.getY(i);
        const z = position.getZ(i);
        
        position.setXYZ(i,
            x + (Math.random() - 0.5) * amount * Math.abs(x) * 0.5,
            y + (Math.random() - 0.5) * amount * Math.abs(y) * 0.5,
            z + (Math.random() - 0.5) * amount * 0.5
        );
    }
    position.needsUpdate = true;
    geometry.computeVertexNormals();
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
    
    cubeGroup.rotation.x += 0.0005;
    cubeGroup.rotation.y += 0.0008;
    
    const time = performance.now() * 0.001;
    wireframe.material.opacity = 0.3 + Math.sin(time * 0.5) * 0.1;
    
    renderer.render(scene, camera);
}

animate();

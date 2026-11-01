import * as THREE from 'three';
import { CrackTexture } from '../effects/CrackTexture.js';
import { createImpactFlash } from '../effects/ImpactFlash.js';
import { animateFaceShatter } from '../effects/ShatterEffect.js';
import { createShardGeometry } from '../utils/GeometryUtils.js';

// Face data
const faceSize = 2;
const halfSize = faceSize / 2;
const faceData = [
    { pos: [0, 0, halfSize], rot: [0, 0, 0], normal: [0, 0, 1] },
    { pos: [0, 0, -halfSize], rot: [0, Math.PI, 0], normal: [0, 0, -1] },
    { pos: [halfSize, 0, 0], rot: [0, -Math.PI / 2, 0], normal: [1, 0, 0] },
    { pos: [-halfSize, 0, 0], rot: [0, Math.PI / 2, 0], normal: [-1, 0, 0] },
    { pos: [0, halfSize, 0], rot: [-Math.PI / 2, 0, 0], normal: [0, 1, 0] },
    { pos: [0, -halfSize, 0], rot: [Math.PI / 2, 0, 0], normal: [0, -1, 0] },
];

const faceGeometry = new THREE.PlaneGeometry(faceSize, faceSize);

const localEdges = new Float32Array([
    -halfSize, -halfSize, 0,  halfSize, -halfSize, 0,
    halfSize, -halfSize, 0,  halfSize, halfSize, 0,
    halfSize, halfSize, 0,  -halfSize, halfSize, 0,
    -halfSize, halfSize, 0,  -halfSize, -halfSize, 0,
]);

const edgeGeometry = new THREE.BufferGeometry();
edgeGeometry.setAttribute('position', new THREE.BufferAttribute(localEdges, 3));

export function createCube(scene) {
    const faces = [];
    const faceWireframes = [];

    faceData.forEach((data, index) => {
        const crackTexture = new CrackTexture(512);
        
        // Use white color so the map texture (cracks) shows through correctly
        // Black color would multiply with the map and make everything black
        const faceMaterial = new THREE.MeshStandardMaterial({
            color: 0xffffff,
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

        const edgeMaterial = new THREE.LineBasicMaterial({ 
            color: 0x333333, 
            transparent: true, 
            opacity: 0.4 
        });
        
        const wireframe = new THREE.LineSegments(edgeGeometry, edgeMaterial);
        wireframe.position.set(...data.pos);
        wireframe.rotation.set(...data.rot);
        scene.add(wireframe);
        faceWireframes.push(wireframe);
    });

    const cubeGroup = new THREE.Group();
    faces.forEach(face => cubeGroup.add(face));
    faceWireframes.forEach(wf => cubeGroup.add(wf));
    scene.add(cubeGroup);

    return { cubeGroup, faces, faceWireframes };
}

export function setupCubeInteraction(faces, faceWireframes, scene, camera, renderer, controls) {
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const state = { facesDestroyed: 0, phase: 'cube' };

    function onClick(event) {
        if (state.phase !== 'cube') return;
        
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(faces.filter(f => f.visible), true);

        if (intersects.length > 0) {
            const hit = intersects[0];
            const hitFace = hit.object;
            const uv = hit.uv;
            const texX = uv.x * 512;
            const texY = (1 - uv.y) * 512;
            handleFaceClick(hitFace, texX, texY);
        }
    }

    function handleFaceClick(face, texX, texY) {
        const userData = face.userData;
        userData.clickCount++;
        
        const severity = userData.clickCount;
        userData.crackTexture.addCracks(severity, texX, texY);
        
        createImpactFlash(face, texX, texY, scene);
        
        if (userData.clickCount >= userData.maxClicks) {
            animateFaceShatter(face, faceWireframes, scene, state);
        }
    }

    window.addEventListener('click', onClick);
    
    return { state };
}

import * as THREE from 'three';
import { CrackTexture } from '../effects/CrackTexture.js';
import { createImpactFlash } from '../effects/ImpactFlash.js';
import { animateFaceShatter } from '../effects/ShatterEffect.js';
import { createRhythmSystem } from '../rhythm/RhythmSystem.js';

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

export function createCube(scene, audioEngine) {
    const faces = [];
    const faceWireframes = [];

    faceData.forEach((data, index) => {
        const crackTexture = new CrackTexture(512);
        
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

    // Create rhythm system
    const rhythmSystem = createRhythmSystem(audioEngine);
    rhythmSystem.start();

    return { cubeGroup, faces, faceWireframes, rhythmSystem };
}

export function setupCubeInteraction(faces, faceWireframes, scene, camera, renderer, controls, rhythmSystem, onAllFacesDestroyed) {
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
            
            // Check rhythm - only register hit if on beat
            const rhythmResult = rhythmSystem.registerClick(hitFace, texX, texY);
            
            if (rhythmResult.success) {
                handleFaceClick(hitFace, texX, texY, rhythmResult.perfect);
            } else {
                // Visual feedback for missed beat
                showMissFeedback(hitFace, scene);
            }
        }
    }

    function handleFaceClick(face, texX, texY, perfect = false) {
        const userData = face.userData;
        userData.clickCount++;
        
        const severity = userData.clickCount;
        userData.crackTexture.addCracks(severity, texX, texY);
        
        createImpactFlash(face, texX, texY, scene, perfect);
        
        if (userData.clickCount >= userData.maxClicks) {
            animateFaceShatter(face, faceWireframes, scene, state, () => {
                // Callback when a face is fully shattered
                state.facesDestroyed++;
                checkAllFacesDestroyed();
            });
        }
    }

    function checkAllFacesDestroyed() {
        if (state.facesDestroyed >= 6 && onAllFacesDestroyed) {
            state.phase = 'well';
            onAllFacesDestroyed();
        }
    }

    function showMissFeedback(face, scene) {
        // Create a red "X" or flash to indicate missed beat
        const worldPos = new THREE.Vector3();
        const worldNormal = new THREE.Vector3();
        face.getWorldPosition(worldPos);
        face.getWorldDirection(worldNormal);
        
        const flashGeo = new THREE.RingGeometry(0.05, 0.2, 8);
        const flashMat = new THREE.MeshBasicMaterial({
            color: 0xff0000,
            transparent: true,
            opacity: 0.6,
            side: THREE.DoubleSide,
            depthWrite: false,
        });
        const flash = new THREE.Mesh(flashGeo, flashMat);
        flash.position.copy(worldPos).addScaledVector(worldNormal, 0.011);
        flash.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), worldNormal);
        scene.add(flash);
        
        const startTime = performance.now();
        const duration = 200;
        
        function animateFlash() {
            const elapsed = performance.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            
            flash.material.opacity = 0.6 * (1 - eased);
            flash.scale.setScalar(1 + eased * 2);
            
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

    window.addEventListener('click', onClick);
    
    return { state, rhythmSystem };
}

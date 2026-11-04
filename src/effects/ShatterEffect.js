import * as THREE from 'three';
import { createShardGeometry } from '../utils/GeometryUtils.js';

export function animateFaceShatter(face, faceWireframes, scene, state, onComplete) {
    const userData = face.userData;
    const crackTexture = userData.crackTexture;
    const faceIndex = userData.faceIndex;
    
    if (faceWireframes[faceIndex]) {
        faceWireframes[faceIndex].visible = false;
    }
    
    const pieces = createShatterPieces(face, crackTexture, scene);
    
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
            
            state.facesDestroyed++;
            if (onComplete) onComplete();
        }
    }
    
    face.visible = false;
    animatePieces();
}

function createShatterPieces(face, crackTexture, scene) {
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

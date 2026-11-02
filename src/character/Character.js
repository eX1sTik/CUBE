import * as THREE from 'three';
import { BruiseTexture } from '../effects/BruiseTexture.js';
import { createBruiseEffect } from '../effects/BruiseEffect.js';

// Cheek region definitions (UV-based for model, or mesh-name based for placeholder)
const CHEEK_REGIONS = {
    left: {
        name: 'LeftCheek',
        uvCenter: { x: 0.25, y: 0.6 },
        uvRadius: 0.15,
        localPosition: new THREE.Vector3(-0.18, 1.75, 0.25),
        normal: new THREE.Vector3(0.5, 0, 1).normalize()
    },
    right: {
        name: 'RightCheek',
        uvCenter: { x: 0.75, y: 0.6 },
        uvRadius: 0.15,
        localPosition: new THREE.Vector3(0.18, 1.75, 0.25),
        normal: new THREE.Vector3(-0.5, 0, 1).normalize()
    }
};

export function createCharacter(model, scene, audioEngine) {
    const characterGroup = new THREE.Group();
    characterGroup.add(model);
    scene.add(characterGroup);
    
    // Enable shadows
    model.traverse((child) => {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
        }
    });
    
    // Find or create cheek meshes for bruising
    const cheekMeshes = {};
    const bruiseTextures = {};
    
    // Try to find existing cheek meshes by name
    model.traverse((child) => {
        if (child.isMesh && (child.name === 'LeftCheek' || child.name === 'RightCheek')) {
            const side = child.name === 'LeftCheek' ? 'left' : 'right';
            cheekMeshes[side] = child;
            
            // Create bruise texture for this cheek
            const bruiseTexture = new BruiseTexture(512);
            
            // Modify material to support bruise overlay
            const originalMaterial = child.material;
            const bruiseMaterial = new THREE.MeshStandardMaterial({
                color: originalMaterial.color || 0xFFDBAC,
                map: originalMaterial.map,
                normalMap: originalMaterial.normalMap,
                roughness: originalMaterial.roughness || 0.5,
                metalness: originalMaterial.metalness || 0.0,
                transparent: true,
                alphaTest: 0.01
            });
            
            // Store original material reference
            child.userData.originalMaterial = originalMaterial;
            child.userData.bruiseTexture = bruiseTexture;
            child.userData.side = side;
            child.material = bruiseMaterial;
            
            bruiseTextures[side] = bruiseTexture;
        }
    });
    
    // If no cheek meshes found, create them (for placeholder)
    if (Object.keys(cheekMeshes).length === 0) {
        Object.entries(CHEEK_REGIONS).forEach(([side, region]) => {
            const cheekGeo = new THREE.SphereGeometry(0.12, 16, 16);
            const bruiseTexture = new BruiseTexture(512);
            
            const cheekMat = new THREE.MeshStandardMaterial({
                color: 0xFFDBAC,
                roughness: 0.5,
                metalness: 0.0,
                transparent: true,
                alphaTest: 0.01,
                map: bruiseTexture.getVisibleTexture(),
                alphaMap: bruiseTexture.getAlphaTexture()
            });
            
            const cheekMesh = new THREE.Mesh(cheekGeo, cheekMat);
            cheekMesh.position.copy(region.localPosition);
            cheekMesh.name = region.name;
            cheekMesh.userData = {
                side: side,
                bruiseTexture: bruiseTexture,
                isCheek: true,
                region: region
            };
            
            characterGroup.add(cheekMesh);
            cheekMeshes[side] = cheekMesh;
            bruiseTextures[side] = bruiseTexture;
        });
    }
    
    // Animation state
    let idleTime = 0;
    const headBone = findBone(model, 'Head') || findBone(model, 'head');
    const spineBone = findBone(model, 'Spine') || findBone(model, 'spine');
    
    return {
        group: characterGroup,
        model: model,
        cheekMeshes: cheekMeshes,
        bruiseTextures: bruiseTextures,
        audioEngine: audioEngine,
        headBone: headBone,
        spineBone: spineBone,
        isHitReacting: false,
        hitReactTime: 0,
        hitReactSide: null,
        
        update() {
            idleTime += 0.016;
            
            // Idle breathing animation
            if (spineBone && !this.isHitReacting) {
                spineBone.rotation.x = Math.sin(idleTime * 0.5) * 0.02;
            }
            
            if (headBone && !this.isHitReacting) {
                headBone.rotation.y = Math.sin(idleTime * 0.3) * 0.1;
                headBone.rotation.x = Math.sin(idleTime * 0.7) * 0.05;
            }
            
            // Hit reaction recovery
            if (this.isHitReacting) {
                this.hitReactTime -= 0.016;
                if (this.hitReactTime <= 0) {
                    this.isHitReacting = false;
                    if (this.headBone) {
                        this.headBone.rotation.z = 0;
                    }
                } else {
                    // Head tilt recovery
                    if (this.headBone) {
                        const recovery = 1 - this.hitReactTime / 0.5;
                        this.headBone.rotation.z = this.hitReactSide === 'left' ? 
                            -0.3 * (1 - recovery) : 0.3 * (1 - recovery);
                    }
                }
            }
        },
        
        hitCheek(side, uv, intensity = 1.0) {
            const cheekMesh = this.cheekMeshes[side];
            const bruiseTexture = this.bruiseTextures[side];
            
            if (!cheekMesh || !bruiseTexture) return false;
            
            // Add bruise at UV position
            const texX = uv.x * 512;
            const texY = (1 - uv.y) * 512;
            bruiseTexture.addBruise(texX, texY, intensity);
            
            // Trigger hit reaction animation
            this.isHitReacting = true;
            this.hitReactTime = 0.5;
            this.hitReactSide = side;
            
            if (this.headBone) {
                this.headBone.rotation.z = side === 'left' ? -0.3 : 0.3;
            }
            
            // Create visual bruise effect
            createBruiseEffect(cheekMesh, uv, scene, intensity);
            
            // Play sound based on rhythm timing
            this.playHitSound(intensity);
            
            return true;
        },
        
        playHitSound(intensity) {
            // Use audio engine to play a subtle hit sound
            if (this.audioEngine && this.audioEngine.ctx) {
                const ctx = this.audioEngine.ctx;
                const now = ctx.currentTime;
                
                // Create a soft "thud" sound
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                const filter = ctx.createBiquadFilter();
                
                osc.type = 'sine';
                osc.frequency.setValueAtTime(120, now);
                osc.frequency.exponentialRampToValueAtTime(60, now + 0.1);
                
                filter.type = 'lowpass';
                filter.frequency.value = 400;
                
                gain.gain.setValueAtTime(0.1 * intensity, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
                
                osc.connect(filter);
                filter.connect(gain);
                gain.connect(this.audioEngine.masterGain);
                
                osc.start(now);
                osc.stop(now + 0.2);
            }
        },
        
        getCheekMesh(side) {
            return this.cheekMeshes[side];
        },
        
        getAllCheekMeshes() {
            return Object.values(this.cheekMeshes);
        }
    };
}

function findBone(object, name) {
    let result = null;
    object.traverse((child) => {
        if (child.isBone && child.name.toLowerCase().includes(name.toLowerCase())) {
            result = child;
        }
    });
    return result;
}

export function setupCharacterInteraction(character, scene, camera, renderer, controls) {
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const cheekMeshes = character.getAllCheekMeshes();
    
    function onClick(event) {
        // Don't interact if controls are dragging
        if (controls.isDragging) return;
        
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(cheekMeshes, true);

        if (intersects.length > 0) {
            const hit = intersects[0];
            const hitMesh = hit.object;
            
            // Find which cheek was hit
            let side = hitMesh.userData.side;
            if (!side) {
                // Try to find parent with side info
                let parent = hitMesh.parent;
                while (parent && !side) {
                    side = parent.userData.side;
                    parent = parent.parent;
                }
            }
            
            if (side && character.hitCheek(side, hit.uv, 1.0)) {
                // Check rhythm timing for bonus effect
                checkRhythmBonus(character, side);
            }
        }
    }
    
    function checkRhythmBonus(character, side) {
        const timingInfo = character.audioEngine.getTimingInfo();
        if (!timingInfo.isPlaying) return;
        
        // Check if hit was on beat (within tolerance)
        const beatInterval = timingInfo.beatInterval;
        const currentTime = character.audioEngine.ctx.currentTime;
        const timeSinceStart = currentTime - timingInfo.startTime;
        const beatPhase = (timeSinceStart % beatInterval) / beatInterval;
        
        // If close to beat (within 15% of beat interval)
        const tolerance = 0.15;
        if (beatPhase < tolerance || beatPhase > 1 - tolerance) {
            // Perfect timing! Add extra bruise intensity
            const bruiseTexture = character.bruiseTextures[side];
            if (bruiseTexture) {
                bruiseTexture.addBruise(
                    Math.random() * 512, 
                    Math.random() * 512, 
                    1.5 // Extra intensity
                );
            }
            
            // Visual feedback for perfect hit
            showPerfectHitFeedback(character.getCheekMesh(side), scene);
        }
    }
    
    function showPerfectHitFeedback(cheekMesh, scene) {
        if (!cheekMesh) return;
        
        const worldPos = new THREE.Vector3();
        cheekMesh.getWorldPosition(worldPos);
        
        // Create sparkle effect
        const particles = new THREE.Group();
        const particleCount = 8;
        
        for (let i = 0; i < particleCount; i++) {
            const geo = new THREE.SphereGeometry(0.02, 4, 4);
            const mat = new THREE.MeshBasicMaterial({ 
                color: 0xffd700,
                transparent: true,
                opacity: 1
            });
            const particle = new THREE.Mesh(geo, mat);
            particle.position.copy(worldPos);
            particle.userData.velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 0.1,
                Math.random() * 0.1 + 0.05,
                (Math.random() - 0.5) * 0.1
            );
            particles.add(particle);
        }
        
        scene.add(particles);
        
        const startTime = performance.now();
        const duration = 800;
        
        function animateParticles() {
            const elapsed = performance.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            particles.children.forEach((particle, i) => {
                particle.position.add(particle.userData.velocity);
                particle.userData.velocity.y -= 0.001;
                particle.material.opacity = 1 - progress;
                particle.scale.setScalar(1 - progress * 0.5);
            });
            
            if (progress < 1) {
                requestAnimationFrame(animateParticles);
            } else {
                scene.remove(particles);
                particles.children.forEach(p => {
                    p.geometry.dispose();
                    p.material.dispose();
                });
            }
        }
        animateParticles();
    }

    window.addEventListener('click', onClick);
    
    // Also add hover effect
    function onMouseMove(event) {
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(cheekMeshes, true);
        
        cheekMeshes.forEach(mesh => {
            if (mesh.material.emissive) {
                mesh.material.emissive.setHex(0x000000);
            }
        });
        
        if (intersects.length > 0) {
            const hitMesh = intersects[0].object;
            if (hitMesh.material.emissive) {
                hitMesh.material.emissive.setHex(0x332200);
            }
        }
    }
    
    window.addEventListener('mousemove', onMouseMove);
    
    return { character };
}

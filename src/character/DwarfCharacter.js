import * as THREE from 'three';
import { BruiseTexture } from '../effects/BruiseTexture.js';
import { createBruiseEffect } from '../effects/BruiseEffect.js';

// Cheek UV regions on the dwarf texture (normalized 0-1)
const CHEEK_UV_REGIONS = {
    left: {
        name: 'LeftCheek',
        uvCenter: { x: 0.32, y: 0.52 },  // Adjust based on your dwarf.jpg
        uvRadius: 0.12,
        localOffset: new THREE.Vector3(-0.15, 0.05, 0.18),
        normal: new THREE.Vector3(0.4, 0, 1).normalize()
    },
    right: {
        name: 'RightCheek',
        uvCenter: { x: 0.68, y: 0.52 },  // Adjust based on your dwarf.jpg
        uvRadius: 0.12,
        localOffset: new THREE.Vector3(0.15, 0.05, 0.18),
        normal: new THREE.Vector3(-0.4, 0, 1).normalize()
    }
};

export function createDwarfCharacter(dwarfTexture, scene, audioEngine) {
    const characterGroup = new THREE.Group();
    characterGroup.position.y = 0.1;
    scene.add(characterGroup);
    
    // Create dwarf as a textured plane with slight curvature for 3D feel
    const dwarfWidth = 2.0;
    const dwarfHeight = 2.8;
    
    // Main dwarf mesh - curved plane for pseudo-3D effect
    const segmentsW = 20;
    const segmentsH = 28;
    const geometry = new THREE.PlaneGeometry(dwarfWidth, dwarfHeight, segmentsW, segmentsH);
    
    // Add slight curvature to vertices for 3D feel
    const position = geometry.attributes.position;
    for (let i = 0; i < position.count; i++) {
        const x = position.getX(i);
        const y = position.getY(i);
        const z = position.getZ(i);
        
        // Curve the plane slightly around Y axis (cylindrical)
        const curveAmount = 0.15;
        const angle = (x / dwarfWidth) * Math.PI * 0.5;
        const newX = Math.sin(angle) * (dwarfWidth / Math.PI * 0.5) * curveAmount;
        const newZ = (1 - Math.cos(angle)) * (dwarfWidth / Math.PI * 0.5) * curveAmount;
        
        // Also add subtle facial feature displacement
        const faceCenterY = 0.1;
        const distFromFaceCenter = Math.sqrt(x * x + (y - faceCenterY * dwarfHeight) * (y - faceCenterY * dwarfHeight)) / dwarfWidth;
        const faceBulge = Math.max(0, 0.08 * (1 - distFromFaceCenter * 3));
        
        position.setXYZ(i, x + newX, y, z + newZ + faceBulge);
    }
    geometry.computeVertexNormals();
    
    // Create material with dwarf texture
    const dwarfMaterial = new THREE.MeshStandardMaterial({
        map: dwarfTexture,
        color: 0xffffff,
        roughness: 0.6,
        metalness: 0.0,
        side: THREE.DoubleSide,
        transparent: true,
        alphaTest: 0.01
    });
    
    const dwarfMesh = new THREE.Mesh(geometry, dwarfMaterial);
    dwarfMesh.castShadow = true;
    dwarfMesh.receiveShadow = true;
    dwarfMesh.name = 'DwarfBody';
    characterGroup.add(dwarfMesh);
    
    // Create separate cheek overlay meshes for bruising
    const cheekMeshes = {};
    const bruiseTextures = {};
    
    Object.entries(CHEEK_UV_REGIONS).forEach(([side, region]) => {
        // Create bruise texture for this cheek
        const bruiseTexture = new BruiseTexture(512);
        bruiseTextures[side] = bruiseTexture;
        
        // Create a small mesh that sits on the cheek area
        const cheekGeo = new THREE.PlaneGeometry(0.35, 0.35, 8, 8);
        
        // Position vertices to match the curved surface
        const cheekPos = cheekGeo.attributes.position;
        for (let i = 0; i < cheekPos.count; i++) {
            const x = cheekPos.getX(i);
            const y = cheekPos.getY(i);
            
            // Map to UV coordinates on main dwarf
            const uvX = region.uvCenter.x + (x / 0.35) * region.uvRadius * 2 - region.uvRadius;
            const uvY = region.uvCenter.y + (y / 0.35) * region.uvRadius * 2 - region.uvRadius;
            
            // Calculate 3D position on curved surface
            const angle = (uvX - 0.5) * Math.PI * 0.5;
            const curveAmount = 0.15;
            const surfaceX = Math.sin(angle) * (dwarfWidth / Math.PI * 0.5) * curveAmount;
            const surfaceZ = (1 - Math.cos(angle)) * (dwarfWidth / Math.PI * 0.5) * curveAmount;
            
            const faceCenterY = 0.1;
            const distFromFaceCenter = Math.sqrt((uvX - 0.5) * (uvX - 0.5) + (uvY - faceCenterY) * (uvY - faceCenterY)) * 2;
            const faceBulge = Math.max(0, 0.08 * (1 - distFromFaceCenter * 1.5));
            
            cheekPos.setXYZ(i, 
                (uvX - 0.5) * dwarfWidth + surfaceX,
                (uvY - 0.5) * dwarfHeight,
                surfaceZ + faceBulge + 0.01 // Slightly in front
            );
        }
        cheekGeo.computeVertexNormals();
        
        // Cheek material with bruise overlay
        const cheekMaterial = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            map: dwarfTexture,
            alphaMap: bruiseTexture.getAlphaTexture(),
            transparent: true,
            alphaTest: 0.01,
            side: THREE.DoubleSide,
            roughness: 0.5,
            metalness: 0.0,
            depthWrite: false // Prevent z-fighting with main mesh
        });
        
        // Set UV coordinates to match cheek region
        const uvAttr = cheekGeo.attributes.uv;
        for (let i = 0; i < uvAttr.count; i++) {
            const u = uvAttr.getX(i);
            const v = uvAttr.getY(i);
            uvAttr.setXY(i,
                region.uvCenter.x + (u - 0.5) * region.uvRadius * 2,
                region.uvCenter.y + (v - 0.5) * region.uvRadius * 2
            );
        }
        uvAttr.needsUpdate = true;
        
        const cheekMesh = new THREE.Mesh(cheekGeo, cheekMaterial);
        cheekMesh.name = region.name;
        cheekMesh.userData = {
            side: side,
            bruiseTexture: bruiseTexture,
            region: region,
            isCheek: true,
            baseUV: { ...region.uvCenter }
        };
        
        characterGroup.add(cheekMesh);
        cheekMeshes[side] = cheekMesh;
    });
    
    // Add a subtle beard mesh for depth
    const beardGeo = new THREE.PlaneGeometry(1.6, 1.2, 10, 8);
    const beardPos = beardGeo.attributes.position;
    for (let i = 0; i < beardPos.count; i++) {
        const x = beardPos.getX(i);
        const y = beardPos.getY(i);
        const angle = (x / 1.6) * Math.PI * 0.5;
        const curveAmount = 0.15;
        const surfaceX = Math.sin(angle) * (dwarfWidth / Math.PI * 0.5) * curveAmount;
        const surfaceZ = (1 - Math.cos(angle)) * (dwarfWidth / Math.PI * 0.5) * curveAmount;
        beardPos.setXYZ(i, x + surfaceX, y - 0.3, surfaceZ + 0.05);
    }
    beardGeo.computeVertexNormals();
    
    const beardMaterial = new THREE.MeshStandardMaterial({
        map: dwarfTexture,
        color: 0xffffff,
        side: THREE.DoubleSide,
        roughness: 0.8,
        metalness: 0.0,
        transparent: true,
        alphaTest: 0.01,
        depthWrite: false
    });
    
    // Set UV for beard area (lower part of texture)
    const beardUV = beardGeo.attributes.uv;
    for (let i = 0; i < beardUV.count; i++) {
        const u = beardUV.getX(i);
        const v = beardUV.getY(i);
        beardUV.setXY(i, u, v * 0.3 + 0.65); // Lower portion of texture
    }
    beardUV.needsUpdate = true;
    
    const beardMesh = new THREE.Mesh(beardGeo, beardMaterial);
    beardMesh.name = 'Beard';
    characterGroup.add(beardMesh);
    
    // Animation state
    let idleTime = 0;
    let breathPhase = 0;
    let swayPhase = 0;
    
    return {
        group: characterGroup,
        dwarfMesh: dwarfMesh,
        cheekMeshes: cheekMeshes,
        bruiseTextures: bruiseTextures,
        audioEngine: audioEngine,
        isHitReacting: false,
        hitReactTime: 0,
        hitReactSide: null,
        hitReactIntensity: 0,
        
        update(deltaTime) {
            idleTime += deltaTime;
            breathPhase += deltaTime * 0.8;
            swayPhase += deltaTime * 0.3;
            
            // Breathing animation - subtle scale on Y
            const breathScale = 1 + Math.sin(breathPhase) * 0.015;
            this.dwarfMesh.scale.y = breathScale;
            
            // Apply to cheek meshes too
            Object.values(this.cheekMeshes).forEach(mesh => {
                mesh.scale.y = breathScale;
            });
            
            // Subtle sway
            const swayX = Math.sin(swayPhase) * 0.008;
            const swayZ = Math.cos(swayPhase * 0.7) * 0.005;
            this.group.rotation.y = swayX;
            this.group.rotation.x = swayZ;
            
            // Hit reaction recovery
            if (this.isHitReacting) {
                this.hitReactTime -= deltaTime;
                const recovery = 1 - Math.max(0, this.hitReactTime / 0.6);
                
                // Head tilt recovery
                const targetTilt = this.hitReactSide === 'left' ? -0.25 : 0.25;
                this.group.rotation.z = targetTilt * (1 - recovery) * (1 - recovery); // easeOutQuad
                
                // Scale punch effect
                const punchScale = 1 + this.hitReactIntensity * 0.15 * (1 - recovery);
                this.dwarfMesh.scale.x = punchScale;
                this.dwarfMesh.scale.y = punchScale * breathScale;
                
                if (this.hitReactTime <= 0) {
                    this.isHitReacting = false;
                    this.group.rotation.z = 0;
                    this.dwarfMesh.scale.x = 1;
                }
            }
            
            // Update bruise textures
            Object.values(this.bruiseTextures).forEach(texture => {
                texture.update(deltaTime * 1000);
            });
        },
        
        hitCheek(side, uv, intensity = 1.0) {
            const cheekMesh = this.cheekMeshes[side];
            const bruiseTexture = this.bruiseTextures[side];
            
            if (!cheekMesh || !bruiseTexture) return false;
            
            // Convert hit UV to bruise texture coordinates
            const region = CHEEK_UV_REGIONS[side];
            const localU = (uv.x - region.uvCenter.x) / (region.uvRadius * 2) + 0.5;
            const localV = (uv.y - region.uvCenter.y) / (region.uvRadius * 2) + 0.5;
            
            // Clamp to valid range
            const texX = Math.max(20, Math.min(492, localU * 512));
            const texY = Math.max(20, Math.min(492, (1 - localV) * 512));
            
            // Add bruise
            bruiseTexture.addBruise(texX, texY, intensity);
            
            // Trigger hit reaction
            this.isHitReacting = true;
            this.hitReactTime = 0.6;
            this.hitReactSide = side;
            this.hitReactIntensity = intensity;
            
            // Immediate head tilt
            this.group.rotation.z = side === 'left' ? -0.25 : 0.25;
            
            // Create visual bruise effect
            createBruiseEffect(cheekMesh, uv, this.group, intensity);
            
            // Play hit sound
            this.playHitSound(intensity);
            
            return true;
        },
        
        playHitSound(intensity) {
            if (this.audioEngine && this.audioEngine.ctx) {
                const ctx = this.audioEngine.ctx;
                const now = ctx.currentTime;
                
                // Soft thud sound
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                const filter = ctx.createBiquadFilter();
                
                osc.type = 'sine';
                osc.frequency.setValueAtTime(150, now);
                osc.frequency.exponentialRampToValueAtTime(70, now + 0.15);
                
                filter.type = 'lowpass';
                filter.frequency.value = 500;
                
                gain.gain.setValueAtTime(0.12 * intensity, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
                
                osc.connect(filter);
                filter.connect(gain);
                gain.connect(this.audioEngine.masterGain);
                
                osc.start(now);
                osc.stop(now + 0.25);
                
                // Add a subtle "skin slap" noise
                if (intensity > 1.0) {
                    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.05, ctx.sampleRate);
                    const noiseData = noiseBuffer.getChannelData(0);
                    for (let i = 0; i < noiseData.length; i++) {
                        noiseData[i] = (Math.random() * 2 - 1) * 0.05;
                    }
                    
                    const noiseSource = ctx.createBufferSource();
                    const noiseGain = ctx.createGain();
                    const noiseFilter = ctx.createBiquadFilter();
                    
                    noiseSource.buffer = noiseBuffer;
                    noiseFilter.type = 'bandpass';
                    noiseFilter.frequency.value = 2000;
                    noiseFilter.Q.value = 2;
                    
                    noiseGain.gain.setValueAtTime(0.08 * intensity, now);
                    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
                    
                    noiseSource.connect(noiseFilter);
                    noiseFilter.connect(noiseGain);
                    noiseGain.connect(this.audioEngine.masterGain);
                    
                    noiseSource.start(now);
                }
            }
        },
        
        getCheekMesh(side) {
            return this.cheekMeshes[side];
        },
        
        getAllCheekMeshes() {
            return Object.values(this.cheekMeshes);
        },
        
        getDwarfMesh() {
            return this.dwarfMesh;
        }
    };
}

export function setupDwarfInteraction(dwarf, scene, camera, renderer, controls) {
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const cheekMeshes = dwarf.getAllCheekMeshes();
    const dwarfMesh = dwarf.getDwarfMesh();
    
    // Combine all clickable meshes
    const clickableMeshes = [...cheekMeshes, dwarfMesh];
    
    function onClick(event) {
        // Don't interact if controls are dragging
        if (controls.isDragging) return;
        
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(clickableMeshes, true);

        if (intersects.length > 0) {
            const hit = intersects[0];
            const hitMesh = hit.object;
            
            // Check if we hit a cheek mesh directly
            let side = hitMesh.userData.side;
            
            // If we hit the main dwarf mesh, determine which cheek based on UV
            if (!side && hitMesh === dwarfMesh && hit.uv) {
                const uv = hit.uv;
                // Determine side based on UV X coordinate
                if (uv.x < 0.5) {
                    side = 'left';
                } else {
                    side = 'right';
                }
                
                // Verify it's actually in the cheek region
                const region = CHEEK_UV_REGIONS[side];
                const distX = Math.abs(uv.x - region.uvCenter.x);
                const distY = Math.abs(uv.y - region.uvCenter.y);
                if (distX > region.uvRadius * 1.5 || distY > region.uvRadius * 1.5) {
                    side = null; // Not on a cheek
                }
            }
            
            // Also check parent hierarchy for cheek data
            if (!side) {
                let parent = hitMesh.parent;
                while (parent && !side) {
                    side = parent.userData.side;
                    parent = parent.parent;
                }
            }
            
            if (side && dwarf.hitCheek(side, hit.uv, 1.0)) {
                // Check rhythm timing for bonus effect
                checkRhythmBonus(dwarf, side);
            }
        }
    }
    
    function checkRhythmBonus(dwarf, side) {
        const timingInfo = dwarf.audioEngine.getTimingInfo();
        if (!timingInfo.isPlaying) return;
        
        const beatInterval = timingInfo.beatInterval;
        const currentTime = dwarf.audioEngine.ctx.currentTime;
        const timeSinceStart = currentTime - timingInfo.startTime;
        const beatPhase = (timeSinceStart % beatInterval) / beatInterval;
        
        const tolerance = 0.15;
        if (beatPhase < tolerance || beatPhase > 1 - tolerance) {
            // Perfect timing! Add extra bruise intensity
            const bruiseTexture = dwarf.bruiseTextures[side];
            if (bruiseTexture) {
                bruiseTexture.addBruise(
                    Math.random() * 400 + 50, 
                    Math.random() * 400 + 50, 
                    1.8
                );
            }
            
            // Visual feedback for perfect hit
            showPerfectHitFeedback(dwarf.getCheekMesh(side), scene);
            
            // Screen shake
            triggerScreenShake(0.02);
        }
    }
    
    function showPerfectHitFeedback(cheekMesh, scene) {
        if (!cheekMesh) return;
        
        const worldPos = new THREE.Vector3();
        cheekMesh.getWorldPosition(worldPos);
        
        // Create golden sparkle particles
        const particles = new THREE.Group();
        const particleCount = 12;
        
        for (let i = 0; i < particleCount; i++) {
            const geo = new THREE.SphereGeometry(0.025, 4, 4);
            const hue = 0.12 + Math.random() * 0.05; // Gold/orange
            const mat = new THREE.MeshBasicMaterial({ 
                color: new THREE.Color().setHSL(hue, 1.0, 0.6),
                transparent: true,
                opacity: 1
            });
            const particle = new THREE.Mesh(geo, mat);
            particle.position.copy(worldPos);
            particle.userData.velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 0.15,
                Math.random() * 0.15 + 0.05,
                (Math.random() - 0.5) * 0.15
            );
            particle.userData.rotationSpeed = (Math.random() - 0.5) * 0.2;
            particles.add(particle);
        }
        
        scene.add(particles);
        
        const startTime = performance.now();
        const duration = 1000;
        
        function animateParticles() {
            const elapsed = performance.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            
            particles.children.forEach((particle) => {
                particle.position.add(particle.userData.velocity);
                particle.userData.velocity.y -= 0.0015;
                particle.userData.velocity.multiplyScalar(0.985);
                particle.rotation.z += particle.userData.rotationSpeed;
                particle.material.opacity = 1 - eased;
                particle.scale.setScalar(1 - eased * 0.7);
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
        
        // Add a brief glow to the cheek
        const originalEmissive = cheekMesh.material.emissive ? cheekMesh.material.emissive.getHex() : 0x000000;
        cheekMesh.material.emissive = new THREE.Color(0xffaa00);
        cheekMesh.material.emissiveIntensity = 0.5;
        
        setTimeout(() => {
            cheekMesh.material.emissive.setHex(originalEmissive);
            cheekMesh.material.emissiveIntensity = 0;
        }, 200);
    }
    
    function triggerScreenShake(intensity) {
        const startTime = performance.now();
        const duration = 150;
        const originalPos = camera.position.clone();
        
        function shake() {
            const elapsed = performance.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - progress;
            
            camera.position.x = originalPos.x + (Math.random() - 0.5) * intensity * eased * 2;
            camera.position.y = originalPos.y + (Math.random() - 0.5) * intensity * eased;
            
            if (progress < 1) {
                requestAnimationFrame(shake);
            } else {
                camera.position.copy(originalPos);
            }
        }
        shake();
    }

    window.addEventListener('click', onClick);
    
    // Hover effect
    function onMouseMove(event) {
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(cheekMeshes, true);
        
        // Reset all cheek emissive
        cheekMeshes.forEach(mesh => {
            if (mesh.material.emissive) {
                mesh.material.emissive.setHex(0x000000);
                mesh.material.emissiveIntensity = 0;
            }
        });
        
        // Highlight hovered cheek
        if (intersects.length > 0) {
            const hitMesh = intersects[0].object;
            if (hitMesh.material.emissive) {
                hitMesh.material.emissive.setHex(0x442200);
                hitMesh.material.emissiveIntensity = 0.3;
            }
            
            // Change cursor
            renderer.domElement.style.cursor = 'pointer';
        } else {
            renderer.domElement.style.cursor = 'default';
        }
    }
    
    window.addEventListener('mousemove', onMouseMove);
    
    // Store reference for animation loop
    window.dwarf = dwarf;
    
    return { dwarf };
}

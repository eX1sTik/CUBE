import * as THREE from 'three';

export function createWell(scene, options = {}) {
    const {
        radius = 2.5,
        depth = 15,
        wallThickness = 0.3,
        segments = 32,
        position = new THREE.Vector3(0, -depth / 2, 0),
        rotation = new THREE.Euler(0, 0, 0)
    } = options;

    console.log('createWell called with:', { radius, depth, position, rotation });

    const wellGroup = new THREE.Group();
    wellGroup.position.copy(position);
    wellGroup.rotation.copy(rotation);

    // Materials
    const stoneMaterial = new THREE.MeshStandardMaterial({
        color: 0x3a3a3a,
        roughness: 0.9,
        metalness: 0.0,
        side: THREE.DoubleSide,
    });

    const darkMaterial = new THREE.MeshBasicMaterial({
        color: 0x000000,
        side: THREE.BackSide,
    });

    const mossMaterial = new THREE.MeshStandardMaterial({
        color: 0x1a3a1a,
        roughness: 1.0,
        metalness: 0.0,
    });

    const waterMaterial = new THREE.MeshStandardMaterial({
        color: 0x000814,
        roughness: 0.1,
        metalness: 0.9,
        transparent: true,
        opacity: 0.7,
        side: THREE.DoubleSide,
    });

    // --- Well Wall (Outer Cylinder) ---
    const outerRadius = radius + wallThickness;
    const wallGeometry = new THREE.CylinderGeometry(outerRadius, outerRadius, depth, segments, 1, true);
    const wall = new THREE.Mesh(wallGeometry, stoneMaterial);
    wall.castShadow = true;
    wall.receiveShadow = true;
    wellGroup.add(wall);

    // --- Well Inner Surface (Darkness) ---
    const innerGeometry = new THREE.CylinderGeometry(radius, radius, depth, segments, 1, true);
    const innerSurface = new THREE.Mesh(innerGeometry, darkMaterial);
    wellGroup.add(innerSurface);

    // --- Top Rim ---
    const rimGeometry = new THREE.CylinderGeometry(outerRadius + 0.15, outerRadius + 0.05, 0.4, segments);
    const rim = new THREE.Mesh(rimGeometry, stoneMaterial);
    rim.position.y = depth / 2;
    rim.castShadow = true;
    rim.receiveShadow = true;
    wellGroup.add(rim);

    // --- Inner Rim (Lip) ---
    const innerRimGeometry = new THREE.CylinderGeometry(radius, radius + 0.1, 0.2, segments);
    const innerRim = new THREE.Mesh(innerRimGeometry, stoneMaterial);
    innerRim.position.y = depth / 2 - 0.1;
    wellGroup.add(innerRim);

    // --- Moss Patches on Wall ---
    const mossPatches = new THREE.Group();
    for (let i = 0; i < 24; i++) {
        const angle = (i / 24) * Math.PI * 2 + Math.random() * 0.2;
        const height = -depth / 2 + 1 + Math.random() * (depth - 2);
        const patchSize = 0.3 + Math.random() * 0.4;
        
        const patchGeo = new THREE.SphereGeometry(patchSize, 6, 4);
        const patch = new THREE.Mesh(patchGeo, mossMaterial);
        
        const x = Math.cos(angle) * (outerRadius + 0.02);
        const z = Math.sin(angle) * (outerRadius + 0.02);
        patch.position.set(x, height, z);
        patch.scale.set(1, 0.3, 1);
        patch.rotation.y = angle + Math.PI / 2;
        
        mossPatches.add(patch);
    }
    wellGroup.add(mossPatches);

    // --- Water Surface at Bottom ---
    const waterGeometry = new THREE.CircleGeometry(radius * 0.9, 32);
    const water = new THREE.Mesh(waterGeometry, waterMaterial);
    water.rotation.x = -Math.PI / 2;
    water.position.y = -depth / 2 + 0.1;
    wellGroup.add(water);

    // --- Water Ripple Animation ---
    let waterTime = 0;
    const originalWaterScale = water.scale.clone();

    // --- Fog Volume Inside Well ---
    const fogGeometry = new THREE.CylinderGeometry(radius * 0.95, radius * 0.95, depth - 1, segments, 1, true);
    const fogMaterial = new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0.3,
        side: THREE.BackSide,
        depthWrite: false,
    });
    const fogVolume = new THREE.Mesh(fogGeometry, fogMaterial);
    fogVolume.position.y = 0;
    wellGroup.add(fogVolume);

    // --- Particle System (Dust/Mist) ---
    const particleCount = 200;
    const particleGeometry = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    const particleSizes = new Float32Array(particleCount);
    const particleAlphas = new Float32Array(particleCount);
    const particleSpeeds = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const r = Math.random() * radius * 0.8;
        particlePositions[i * 3] = Math.cos(angle) * r;
        particlePositions[i * 3 + 1] = -depth / 2 + Math.random() * (depth - 1);
        particlePositions[i * 3 + 2] = Math.sin(angle) * r;
        particleSizes[i] = 0.02 + Math.random() * 0.05;
        particleAlphas[i] = 0.1 + Math.random() * 0.3;
        particleSpeeds[i] = 0.005 + Math.random() * 0.02;
    }

    particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    particleGeometry.setAttribute('size', new THREE.BufferAttribute(particleSizes, 1));
    particleGeometry.setAttribute('alpha', new THREE.BufferAttribute(particleAlphas, 1));

    const particleMaterial = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.05,
        transparent: true,
        opacity: 0.4,
        depthWrite: false,
        vertexColors: false,
        sizeAttenuation: true,
    });

    const particles = new THREE.Points(particleGeometry, particleMaterial);
    wellGroup.add(particles);

    // --- Light at Bottom (Subtle Glow) ---
    const bottomLight = new THREE.PointLight(0x001133, 0.5, radius * 3);
    bottomLight.position.set(0, -depth / 2 + 0.5, 0);
    bottomLight.castShadow = false;
    wellGroup.add(bottomLight);

    // --- Animation ---
    function update(deltaTime) {
        waterTime += deltaTime;
        
        // Water ripple
        const ripple = Math.sin(waterTime * 2) * 0.01 + 1;
        water.scale.setScalar(ripple);
        water.material.opacity = 0.5 + Math.sin(waterTime * 3) * 0.1;

        // Particle floating
        const positions = particleGeometry.attributes.position.array;
        const speeds = particleSpeeds;
        for (let i = 0; i < particleCount; i++) {
            positions[i * 3 + 1] += speeds[i] * deltaTime * 60;
            if (positions[i * 3 + 1] > depth / 2 - 1) {
                positions[i * 3 + 1] = -depth / 2 + 0.5;
            }
        }
        particleGeometry.attributes.position.needsUpdate = true;

        // Fog pulse
        fogMaterial.opacity = 0.2 + Math.sin(waterTime * 0.5) * 0.1;

        // Bottom light pulse
        bottomLight.intensity = 0.3 + Math.sin(waterTime * 1.7) * 0.2;
    }

    // --- Interaction: Look Into Well ---
    function getLookAtTarget() {
        return new THREE.Vector3(0, -depth / 2, 0).applyMatrix4(wellGroup.matrixWorld);
    }

    function getInnerRadius() {
        return radius;
    }

    function getDepth() {
        return depth;
    }

    function getWorldPosition() {
        const pos = new THREE.Vector3();
        wellGroup.getWorldPosition(pos);
        return pos;
    }

    // Add to scene
    scene.add(wellGroup);
    console.log('Well added to scene, wellGroup:', wellGroup);

    return {
        group: wellGroup,
        update,
        getLookAtTarget,
        getInnerRadius,
        getDepth,
        getWorldPosition,
        water,
        particles,
        bottomLight,
        fogVolume,
        
        // Cleanup
        dispose: () => {
            scene.remove(wellGroup);
            wallGeometry.dispose();
            innerGeometry.dispose();
            rimGeometry.dispose();
            innerRimGeometry.dispose();
            waterGeometry.dispose();
            fogGeometry.dispose();
            particleGeometry.dispose();
            stoneMaterial.dispose();
            darkMaterial.dispose();
            mossMaterial.dispose();
            waterMaterial.dispose();
            fogMaterial.dispose();
            particleMaterial.dispose();
            
            mossPatches.children.forEach(child => {
                child.geometry.dispose();
            });
        }
    };
}

// Helper: Create a cinematic "peeking into well" camera animation
export function createWellPeekAnimation(camera, well, duration = 3000) {
    const startPosition = camera.position.clone();
    const startTarget = new THREE.Vector3();
    camera.getWorldDirection(startTarget);
    startTarget.multiplyScalar(10).add(camera.position);
    
    const endPosition = well.getWorldPosition().clone();
    endPosition.y += well.getDepth() * 0.3;
    endPosition.z += well.getInnerRadius() * 1.5;
    
    const endTarget = well.getLookAtTarget();
    
    const startTime = performance.now();
    
    function animate() {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
        
        camera.position.lerpVectors(startPosition, endPosition, eased);
        camera.lookAt(
            new THREE.Vector3().lerpVectors(startTarget, endTarget, eased)
        );
        
        if (progress < 1) {
            requestAnimationFrame(animate);
        }
    }
    
    animate();
}

import * as THREE from 'three';

export function createBruiseEffect(cheekMesh, uv, scene, intensity = 1.0) {
    const worldPos = new THREE.Vector3();
    const worldNormal = new THREE.Vector3();
    cheekMesh.getWorldPosition(worldPos);
    cheekMesh.getWorldDirection(worldNormal);
    
    // Create impact ring
    const ringGeo = new THREE.RingGeometry(0.02, 0.08, 32);
    const ringMat = new THREE.MeshBasicMaterial({
        color: 0x8B0000,
        transparent: true,
        opacity: 0.6 * intensity,
        side: THREE.DoubleSide,
        depthWrite: false,
        depthTest: true
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.copy(worldPos).addScaledVector(worldNormal, 0.001);
    ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), worldNormal);
    scene.add(ring);
    
    // Create particle burst
    const particles = new THREE.Group();
    const particleCount = 12 * intensity;
    
    for (let i = 0; i < particleCount; i++) {
        const size = 0.01 + Math.random() * 0.015;
        const geo = new THREE.SphereGeometry(size, 4, 4);
        const mat = new THREE.MeshBasicMaterial({ 
            color: new THREE.Color().setHSL(0.95 + Math.random() * 0.05, 0.8, 0.4 + Math.random() * 0.2),
            transparent: true,
            opacity: 0.8
        });
        const particle = new THREE.Mesh(geo, mat);
        particle.position.copy(worldPos);
        
        // Velocity in hemisphere around normal
        const angle = Math.random() * Math.PI * 2;
        const inclination = Math.random() * Math.PI * 0.5; // Upward hemisphere
        const speed = 0.02 + Math.random() * 0.04;
        
        particle.userData.velocity = new THREE.Vector3(
            Math.sin(inclination) * Math.cos(angle) * speed,
            Math.cos(inclination) * speed,
            Math.sin(inclination) * Math.sin(angle) * speed
        ).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(
            new THREE.Vector3(0, 1, 0), worldNormal
        ));
        
        particle.userData.life = 1.0;
        particle.userData.decay = 0.015 + Math.random() * 0.01;
        particles.add(particle);
    }
    
    scene.add(particles);
    
    const startTime = performance.now();
    const duration = 600 * intensity;
    
    function animateEffect() {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        
        // Animate ring
        ring.material.opacity = 0.6 * intensity * (1 - eased);
        ring.scale.setScalar(1 + eased * 4);
        
        // Animate particles
        particles.children.forEach(particle => {
            particle.position.add(particle.userData.velocity);
            particle.userData.velocity.y -= 0.0003; // Gravity
            particle.userData.velocity.multiplyScalar(0.98); // Air resistance
            particle.userData.life -= particle.userData.decay;
            particle.material.opacity = 0.8 * particle.userData.life;
            particle.scale.setScalar(particle.userData.life);
        });
        
        if (progress < 1) {
            requestAnimationFrame(animateEffect);
        } else {
            scene.remove(ring);
            ring.geometry.dispose();
            ring.material.dispose();
            
            scene.remove(particles);
            particles.children.forEach(p => {
                p.geometry.dispose();
                p.material.dispose();
            });
        }
    }
    animateEffect();
    
    // Also create a subtle screen-space flash if it's a strong hit
    if (intensity > 1.2) {
        createScreenFlash(scene, intensity);
    }
}

function createScreenFlash(scene, intensity) {
    // This would be a full-screen quad in a real implementation
    // For now, just log it
    console.log('Strong hit! Screen flash intensity:', intensity);
}

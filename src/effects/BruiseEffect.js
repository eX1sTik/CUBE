import * as THREE from 'three';

export function createBruiseEffect(cheekMesh, uv, parentGroup, intensity = 1.0) {
    const worldPos = new THREE.Vector3();
    const worldNormal = new THREE.Vector3();
    cheekMesh.getWorldPosition(worldPos);
    cheekMesh.getWorldDirection(worldNormal);
    
    // Create impact ring
    const ringGeo = new THREE.RingGeometry(0.03, 0.1, 32);
    const ringMat = new THREE.MeshBasicMaterial({
        color: 0x8B0000,
        transparent: true,
        opacity: 0.7 * intensity,
        side: THREE.DoubleSide,
        depthWrite: false,
        depthTest: true
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.copy(worldPos).addScaledVector(worldNormal, 0.002);
    ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), worldNormal);
    parentGroup.add(ring);
    
    // Create particle burst - blood/skin particles
    const particles = new THREE.Group();
    const particleCount = Math.floor(15 * intensity);
    
    for (let i = 0; i < particleCount; i++) {
        const size = 0.015 + Math.random() * 0.02;
        const geo = new THREE.SphereGeometry(size, 4, 4);
        // Bruise colors: dark red to purple
        const hue = 0.95 + Math.random() * 0.05;
        const sat = 0.7 + Math.random() * 0.3;
        const light = 0.3 + Math.random() * 0.3;
        const mat = new THREE.MeshBasicMaterial({ 
            color: new THREE.Color().setHSL(hue, sat, light),
            transparent: true,
            opacity: 0.9
        });
        const particle = new THREE.Mesh(geo, mat);
        particle.position.copy(worldPos);
        
        // Velocity in hemisphere around normal
        const angle = Math.random() * Math.PI * 2;
        const inclination = Math.random() * Math.PI * 0.4; // Forward hemisphere
        const speed = 0.03 + Math.random() * 0.05;
        
        particle.userData.velocity = new THREE.Vector3(
            Math.sin(inclination) * Math.cos(angle) * speed,
            Math.cos(inclination) * speed * 0.5 + (Math.random() - 0.5) * 0.02,
            Math.sin(inclination) * Math.sin(angle) * speed
        ).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(
            new THREE.Vector3(0, 1, 0), worldNormal
        ));
        
        particle.userData.life = 1.0;
        particle.userData.decay = 0.02 + Math.random() * 0.015;
        particle.userData.rotationSpeed = (Math.random() - 0.5) * 0.3;
        particles.add(particle);
    }
    
    // Add some "sweat/droplet" particles
    for (let i = 0; i < Math.floor(5 * intensity); i++) {
        const size = 0.01 + Math.random() * 0.01;
        const geo = new THREE.SphereGeometry(size, 4, 4);
        const mat = new THREE.MeshBasicMaterial({ 
            color: 0x664422,
            transparent: true,
            opacity: 0.6
        });
        const particle = new THREE.Mesh(geo, mat);
        particle.position.copy(worldPos);
        
        const angle = Math.random() * Math.PI * 2;
        const speed = 0.02 + Math.random() * 0.03;
        particle.userData.velocity = new THREE.Vector3(
            Math.cos(angle) * speed,
            -0.01 - Math.random() * 0.02,
            Math.sin(angle) * speed
        ).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(
            new THREE.Vector3(0, 1, 0), worldNormal
        ));
        
        particle.userData.life = 1.0;
        particle.userData.decay = 0.015;
        particles.add(particle);
    }
    
    parentGroup.add(particles);
    
    const startTime = performance.now();
    const duration = 800 * intensity;
    
    function animateEffect() {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        
        // Animate ring
        ring.material.opacity = 0.7 * intensity * (1 - eased);
        ring.scale.setScalar(1 + eased * 5);
        
        // Animate particles
        particles.children.forEach(particle => {
            particle.position.add(particle.userData.velocity);
            particle.userData.velocity.y -= 0.0005; // Gravity
            particle.userData.velocity.multiplyScalar(0.985); // Air resistance
            particle.userData.life -= particle.userData.decay;
            particle.material.opacity = 0.9 * particle.userData.life;
            particle.scale.setScalar(particle.userData.life);
            if (particle.userData.rotationSpeed) {
                particle.rotation.z += particle.userData.rotationSpeed;
            }
        });
        
        if (progress < 1) {
            requestAnimationFrame(animateEffect);
        } else {
            parentGroup.remove(ring);
            ring.geometry.dispose();
            ring.material.dispose();
            
            parentGroup.remove(particles);
            particles.children.forEach(p => {
                p.geometry.dispose();
                p.material.dispose();
            });
        }
    }
    animateEffect();
    
    // Strong hit screen flash
    if (intensity > 1.3) {
        createScreenFlash(parentGroup, intensity);
    }
}

function createScreenFlash(parentGroup, intensity) {
    // Create a full-screen quad for flash effect
    const flashGeo = new THREE.PlaneGeometry(2, 2);
    const flashMat = new THREE.MeshBasicMaterial({
        color: 0xff4444,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        depthTest: false
    });
    const flash = new THREE.Mesh(flashGeo, flashMat);
    flash.renderOrder = 999;
    
    // Position in front of camera
    const camera = parentGroup.userData.camera;
    if (camera) {
        flash.position.set(0, 0, -0.5);
        camera.add(flash);
    } else {
        parentGroup.add(flash);
    }
    
    const startTime = performance.now();
    const duration = 100;
    
    function animateFlash() {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        if (progress < 0.3) {
            flash.material.opacity = 0.15 * intensity * (progress / 0.3);
        } else {
            flash.material.opacity = 0.15 * intensity * (1 - (progress - 0.3) / 0.7);
        }
        
        if (progress < 1) {
            requestAnimationFrame(animateFlash);
        } else {
            if (camera) camera.remove(flash);
            else parentGroup.remove(flash);
            flash.geometry.dispose();
            flash.material.dispose();
        }
    }
    animateFlash();
}

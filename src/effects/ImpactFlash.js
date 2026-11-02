import * as THREE from 'three';

export function createImpactFlash(face, texX, texY, scene, perfect = false) {
    const flashGeo = new THREE.RingGeometry(0.01, 0.15, 32);
    const flashMat = new THREE.MeshBasicMaterial({
        color: perfect ? 0x00ff88 : 0xffffff,
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
    const duration = perfect ? 200 : 150;
    
    function animateFlash() {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        
        flash.material.opacity = 0.8 * (1 - eased);
        flash.scale.setScalar(1 + eased * (perfect ? 4 : 3));
        
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

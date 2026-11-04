import * as THREE from 'three';

export function startWellDive(camera, controls, scene, wellGroup, depth) {
    if (window.diveActive) return;
    window.diveActive = true;
    if (controls) controls.enabled = false;

    const startPos = camera.position.clone();
    const bottomY = wellGroup.position.y - depth / 2 + 0.5;
    const targetPos = new THREE.Vector3(
        wellGroup.position.x,
        bottomY,
        wellGroup.position.z
    );

    const startTime = performance.now();
    const duration = 2500;

    scene.background.setHex(0x000000);
    if (!scene.fog) {
        scene.fog = new THREE.FogExp2(0x000000, 0.05);
    }

    const overlayGeo = new THREE.PlaneGeometry(20, 20);
    const overlayMat = new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        depthTest: false,
    });
    const overlay = new THREE.Mesh(overlayGeo, overlayMat);
    overlay.position.set(0, 0, -1);
    camera.add(overlay);

    const animateDive = () => {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeIn = progress * progress * progress;

        camera.position.lerpVectors(startPos, targetPos, easeIn);
        camera.lookAt(wellGroup.position.x, bottomY, wellGroup.position.z);
        camera.rotation.z = easeIn * 0.15;

        overlayMat.opacity = easeIn * 0.95;

        if (scene.fog) {
            scene.fog.density = 0.05 + easeIn * 0.15;
        }

        if (progress < 1) {
            requestAnimationFrame(animateDive);
        } else {
            overlayMat.opacity = 1;
            window.diveComplete = true;
        }
    };

    animateDive();
}

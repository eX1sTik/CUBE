import * as THREE from 'three';

export function createWell(scene, options = {}) {
    const {
        radius = 2.5,
        depth = 15,
        wallThickness = 0.4,
        segments = 32,
        position = new THREE.Vector3(0, -depth / 2, 0),
        rotation = new THREE.Euler(0, 0, 0)
    } = options;

    const wellGroup = new THREE.Group();
    wellGroup.position.copy(position);
    wellGroup.rotation.copy(rotation);

    // Stone brick material
    const stoneMaterial = new THREE.MeshStandardMaterial({
        color: 0x4a4a4a,
        roughness: 0.95,
        metalness: 0.05,
    });

    // Black water material
    const waterMaterial = new THREE.MeshStandardMaterial({
        color: 0x000000,
        roughness: 0.0,
        metalness: 0.0,
        transparent: true,
        opacity: 1.0,
        side: THREE.DoubleSide,
    });

    // Stone brick wall (cylinder made of stacked brick rings)
    const outerRadius = radius + wallThickness;
    const wallGeometry = new THREE.CylinderGeometry(outerRadius, outerRadius, depth, segments, 8, false);
    const wall = new THREE.Mesh(wallGeometry, stoneMaterial);
    wall.castShadow = true;
    wall.receiveShadow = true;
    wall.name = 'well-wall';
    wellGroup.add(wall);

    // Inner dark surface
    const innerGeometry = new THREE.CylinderGeometry(radius, radius, depth, segments, 1, true);
    const innerSurface = new THREE.Mesh(innerGeometry, new THREE.MeshBasicMaterial({
        color: 0x050505,
        side: THREE.BackSide,
    }));
    innerSurface.name = 'well-inner';
    wellGroup.add(innerSurface);

    // Stone rim at top
    const rimGeometry = new THREE.CylinderGeometry(outerRadius + 0.2, outerRadius + 0.05, 0.5, segments);
    const rim = new THREE.Mesh(rimGeometry, stoneMaterial);
    rim.position.y = depth / 2;
    rim.castShadow = true;
    rim.receiveShadow = true;
    rim.name = 'well-rim';
    wellGroup.add(rim);

    // Black water at bottom
    const waterGeometry = new THREE.CircleGeometry(radius * 0.85, 32);
    const water = new THREE.Mesh(waterGeometry, waterMaterial);
    water.rotation.x = -Math.PI / 2;
    water.position.y = -depth / 2 + 0.2;
    water.name = 'well-water';
    wellGroup.add(water);

    scene.add(wellGroup);

    return {
        group: wellGroup,
        getLookAtTarget: () => new THREE.Vector3(0, -depth / 2, 0).applyMatrix4(wellGroup.matrixWorld),
        getInnerRadius: () => radius,
        getDepth: () => depth,
        getWorldPosition: () => {
            const pos = new THREE.Vector3();
            wellGroup.getWorldPosition(pos);
            return pos;
        },
        water,
        dispose: () => {
            scene.remove(wellGroup);
            wallGeometry.dispose();
            innerGeometry.dispose();
            rimGeometry.dispose();
            waterGeometry.dispose();
            stoneMaterial.dispose();
            waterMaterial.dispose();
        }
    };
}

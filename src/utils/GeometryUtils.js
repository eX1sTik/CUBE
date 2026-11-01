import * as THREE from 'three';

export function createShardGeometry() {
    const shapeType = Math.random();
    
    if (shapeType < 0.3) {
        const width = 0.08 + Math.random() * 0.25;
        const height = 0.08 + Math.random() * 0.25;
        const depth = 0.01 + Math.random() * 0.02;
        const geo = new THREE.BoxGeometry(width, height, depth);
        distortGeometry(geo, 0.15);
        return geo;
    } else if (shapeType < 0.55) {
        const size = 0.1 + Math.random() * 0.2;
        const geo = new THREE.BufferGeometry();
        const vertices = new Float32Array([
            0, size * 0.5, 0,
            -size * 0.5, -size * 0.5, 0,
            size * 0.5, -size * 0.5, 0,
            0, size * 0.5, -0.02,
            size * 0.5, -size * 0.5, -0.02,
            -size * 0.5, -size * 0.5, -0.02,
        ]);
        const indices = [
            0, 1, 2, 3, 4, 5, 0, 2, 4, 4, 1, 0, 1, 4, 5, 5, 2, 1, 2, 5, 3, 3, 0, 2,
        ];
        geo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
        geo.setIndex(indices);
        geo.computeVertexNormals();
        distortGeometry(geo, 0.2);
        return geo;
    } else if (shapeType < 0.75) {
        const length = 0.15 + Math.random() * 0.3;
        const width = 0.03 + Math.random() * 0.04;
        const depth = 0.01 + Math.random() * 0.015;
        const geo = new THREE.BoxGeometry(width, length, depth);
        distortGeometry(geo, 0.25);
        return geo;
    } else {
        const size = 0.12 + Math.random() * 0.18;
        const geo = new THREE.BoxGeometry(size, size, 0.02 + Math.random() * 0.03);
        distortGeometry(geo, 0.3);
        return geo;
    }
}

export function distortGeometry(geometry, amount) {
    const position = geometry.attributes.position;
    for (let i = 0; i < position.count; i++) {
        const x = position.getX(i);
        const y = position.getY(i);
        const z = position.getZ(i);
        
        position.setXYZ(i,
            x + (Math.random() - 0.5) * amount * Math.abs(x) * 0.5,
            y + (Math.random() - 0.5) * amount * Math.abs(y) * 0.5,
            z + (Math.random() - 0.5) * amount * 0.5
        );
    }
    position.needsUpdate = true;
    geometry.computeVertexNormals();
}

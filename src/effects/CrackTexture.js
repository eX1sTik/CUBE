export class CrackTexture {
    constructor(size = 512) {
        this.size = size;
        
        this.visibleCanvas = document.createElement('canvas');
        this.visibleCanvas.width = size;
        this.visibleCanvas.height = size;
        this.visibleCtx = this.visibleCanvas.getContext('2d');
        this.visibleTexture = new THREE.CanvasTexture(this.visibleCanvas);
        this.visibleTexture.wrapS = THREE.ClampToEdgeWrapping;
        this.visibleTexture.wrapT = THREE.ClampToEdgeWrapping;
        
        this.alphaCanvas = document.createElement('canvas');
        this.alphaCanvas.width = size;
        this.alphaCanvas.height = size;
        this.alphaCtx = this.alphaCanvas.getContext('2d');
        this.alphaTexture = new THREE.CanvasTexture(this.alphaCanvas);
        this.alphaTexture.wrapS = THREE.ClampToEdgeWrapping;
        this.alphaTexture.wrapT = THREE.ClampToEdgeWrapping;
        
        this.cracks = [];
        this.impactPoints = [];
        this.clear();
    }

    clear() {
        this.visibleCtx.fillStyle = '#000000';
        this.visibleCtx.fillRect(0, 0, this.size, this.size);
        this.alphaCtx.fillStyle = 'white';
        this.alphaCtx.fillRect(0, 0, this.size, this.size);
        this.cracks = [];
        this.impactPoints = [];
        this.updateTextures();
    }

    addImpact(x, y) {
        this.impactPoints.push({ x, y });
    }

    generateWindshieldCracks(impactX, impactY, severity) {
        const newCracks = [];
        const radialCount = 3 + severity * 2;
        
        for (let i = 0; i < radialCount; i++) {
            const baseAngle = (i / radialCount) * Math.PI * 2;
            const angleVariation = (Math.random() - 0.5) * (Math.PI / radialCount) * 0.5;
            const angle = baseAngle + angleVariation;
            
            const path = this.generateRadialCrack(impactX, impactY, angle, severity);
            if (path.length > 1) newCracks.push(path);
            
            if (Math.random() < 0.3 && severity > 0) {
                const branchAngle = angle + (Math.random() - 0.5) * 0.8;
                const branchPath = this.generateRadialCrack(impactX, impactY, branchAngle, severity - 0.5, 0.5);
                if (branchPath.length > 1) newCracks.push(branchPath);
            }
        }
        
        const ringCount = severity;
        for (let r = 0; r < ringCount; r++) {
            const radius = 20 + r * 30 + severity * 15 + Math.random() * 10;
            const ringCracks = this.generateConcentricRing(impactX, impactY, radius, severity);
            newCracks.push(...ringCracks);
        }
        
        for (let i = 0; i < 2 + severity; i++) {
            const chipAngle = Math.random() * Math.PI * 2;
            const chipDist = Math.random() * 8;
            const chipX = impactX + Math.cos(chipAngle) * chipDist;
            const chipY = impactY + Math.sin(chipAngle) * chipDist;
            const chipPath = this.generateChipCrack(chipX, chipY);
            if (chipPath.length > 1) newCracks.push(chipPath);
        }
        
        this.cracks.push(...newCracks);
    }

    generateRadialCrack(cx, cy, angle, severity, lengthMult = 1.0) {
        const path = [{ x: cx, y: cy }];
        const maxLength = (80 + severity * 60) * lengthMult;
        let x = cx, y = cy;
        let currentAngle = angle;
        let traveled = 0;
        
        while (traveled < maxLength) {
            const step = 8 + Math.random() * 15;
            const angleJitter = (Math.random() - 0.5) * 0.5 * (1 + severity * 0.3);
            currentAngle += angleJitter;
            
            x += Math.cos(currentAngle) * step;
            y += Math.sin(currentAngle) * step;
            traveled += step;
            
            if (x < 0) { x = Math.abs(x); currentAngle = Math.PI - currentAngle; }
            if (x > this.size) { x = 2 * this.size - x; currentAngle = Math.PI - currentAngle; }
            if (y < 0) { y = Math.abs(y); currentAngle = -currentAngle; }
            if (y > this.size) { y = 2 * this.size - y; currentAngle = -currentAngle; }
            
            path.push({ x, y });
            
            if (Math.random() < 0.1 * (1 + severity) && traveled > 20) {
                const branchAngle = currentAngle + (Math.random() > 0.5 ? 1 : -1) * (Math.PI/2.5 + Math.random() * Math.PI/2.5);
                const branchLength = 15 + Math.random() * 25 * (0.5 + severity * 0.3);
                const bx = x + Math.cos(branchAngle) * branchLength;
                const by = y + Math.sin(branchAngle) * branchLength;
                this.cracks.push([{ x, y }, { x: bx, y: by }]);
            }
            
            if (x < 10 || x > this.size - 10 || y < 10 || y > this.size - 10) break;
        }
        return path;
    }

    generateConcentricRing(cx, cy, radius, severity) {
        const cracks = [];
        const segments = 6 + Math.floor(severity * 2) + Math.floor(radius / 15);
        
        for (let i = 0; i < segments; i++) {
            const startAngle = (i / segments) * Math.PI * 2;
            const endAngle = ((i + 0.7 + Math.random() * 0.3) / segments) * Math.PI * 2;
            
            if (Math.random() < 0.6 + severity * 0.1) {
                const path = [];
                const steps = 4 + Math.floor((endAngle - startAngle) * 8);
                
                for (let s = 0; s <= steps; s++) {
                    const a = startAngle + (endAngle - startAngle) * (s / steps);
                    const r = radius + (Math.random() - 0.5) * 6 * (1 + severity * 0.4);
                    const x = cx + Math.cos(a) * r;
                    const y = cy + Math.sin(a) * r;
                    
                    if (x > 5 && x < this.size - 5 && y > 5 && y < this.size - 5) {
                        path.push({ x, y });
                    }
                }
                if (path.length > 2) cracks.push(path);
            }
        }
        return cracks;
    }

    generateChipCrack(cx, cy) {
        const path = [{ x: cx, y: cy }];
        const angle = Math.random() * Math.PI * 2;
        const length = 5 + Math.random() * 15;
        const x = cx + Math.cos(angle) * length;
        const y = cy + Math.sin(angle) * length;
        path.push({ x, y });
        return path;
    }

    addCracks(severity, impactX, impactY) {
        const severityLevel = Math.min(severity, 4) - 1;
        if (impactX !== undefined && impactY !== undefined) {
            this.addImpact(impactX, impactY);
            this.generateWindshieldCracks(impactX, impactY, severityLevel);
        }
        this.redraw();
    }

    redraw() {
        this.visibleCtx.fillStyle = '#000000';
        this.visibleCtx.fillRect(0, 0, this.size, this.size);
        this.alphaCtx.fillStyle = 'white';
        this.alphaCtx.fillRect(0, 0, this.size, this.size);

        this.cracks.forEach((path, pathIndex) => {
            if (path.length < 2) return;
            
            const isMain = pathIndex < this.cracks.length * 0.4;
            const baseWidth = isMain ? 2.5 : 1.5;
            
            this.visibleCtx.strokeStyle = '#000000';
            this.visibleCtx.lineWidth = baseWidth + 1;
            this.visibleCtx.lineCap = 'round';
            this.visibleCtx.lineJoin = 'round';
            this.visibleCtx.shadowColor = 'rgba(0,0,0,0.5)';
            this.visibleCtx.shadowBlur = 2;
            this.drawPath(this.visibleCtx, path);
            this.visibleCtx.shadowBlur = 0;
            
            this.visibleCtx.strokeStyle = '#ffffff';
            this.visibleCtx.lineWidth = baseWidth * 0.4;
            this.visibleCtx.globalCompositeOperation = 'screen';
            this.drawPath(this.visibleCtx, path);
            this.visibleCtx.globalCompositeOperation = 'source-over';
            
            this.visibleCtx.strokeStyle = '#444444';
            this.visibleCtx.lineWidth = baseWidth * 0.8;
            this.visibleCtx.globalCompositeOperation = 'overlay';
            this.drawPath(this.visibleCtx, path);
            this.visibleCtx.globalCompositeOperation = 'source-over';
            
            this.visibleCtx.strokeStyle = '#aaaaaa';
            this.visibleCtx.lineWidth = baseWidth * 0.15;
            this.drawPath(this.visibleCtx, path);

            this.alphaCtx.strokeStyle = 'black';
            this.alphaCtx.lineWidth = baseWidth + 2;
            this.alphaCtx.lineCap = 'round';
            this.alphaCtx.lineJoin = 'round';
            this.drawPath(this.alphaCtx, path);
        });

        this.impactPoints.forEach(pt => {
            const grad = this.visibleCtx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, 6);
            grad.addColorStop(0, '#000000');
            grad.addColorStop(0.5, '#222222');
            grad.addColorStop(1, '#000000');
            this.visibleCtx.fillStyle = grad;
            this.visibleCtx.beginPath();
            this.visibleCtx.arc(pt.x, pt.y, 6, 0, Math.PI * 2);
            this.visibleCtx.fill();
            
            this.visibleCtx.strokeStyle = '#ffffff';
            this.visibleCtx.lineWidth = 1.5;
            this.visibleCtx.globalCompositeOperation = 'screen';
            this.visibleCtx.beginPath();
            this.visibleCtx.arc(pt.x, pt.y, 5, 0, Math.PI * 2);
            this.visibleCtx.stroke();
            this.visibleCtx.globalCompositeOperation = 'source-over';
            
            this.alphaCtx.fillStyle = 'black';
            this.alphaCtx.beginPath();
            this.alphaCtx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
            this.alphaCtx.fill();
        });

        this.updateTextures();
    }

    drawPath(ctx, path) {
        if (path.length < 2) return;
        ctx.beginPath();
        ctx.moveTo(path[0].x, path[0].y);
        for (let i = 1; i < path.length; i++) {
            const xc = (path[i-1].x + path[i].x) / 2;
            const yc = (path[i-1].y + path[i].y) / 2;
            ctx.quadraticCurveTo(path[i-1].x, path[i-1].y, xc, yc);
        }
        if (path.length > 1) {
            const last = path[path.length - 1];
            const prev = path[path.length - 2];
            ctx.quadraticCurveTo(prev.x, prev.y, last.x, last.y);
        }
        ctx.stroke();
    }

    updateTextures() {
        this.visibleTexture.needsUpdate = true;
        this.alphaTexture.needsUpdate = true;
    }

    getVisibleTexture() { return this.visibleTexture; }
    getAlphaTexture() { return this.alphaTexture; }
}

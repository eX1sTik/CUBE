import * as THREE from 'three';

export class BruiseTexture {
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
        
        this.bruises = [];
        this.clear();
    }

    clear() {
        // Skin base color
        this.visibleCtx.fillStyle = '#FFDBAC';
        this.visibleCtx.fillRect(0, 0, this.size, this.size);
        
        // Alpha starts fully opaque (no bruising)
        this.alphaCtx.fillStyle = 'white';
        this.alphaCtx.fillRect(0, 0, this.size, this.size);
        
        this.bruises = [];
        this.updateTextures();
    }

    addBruise(x, y, intensity = 1.0) {
        // Clamp to texture bounds
        x = Math.max(20, Math.min(this.size - 20, x));
        y = Math.max(20, Math.min(this.size - 20, y));
        
        const bruise = {
            x: x,
            y: y,
            intensity: Math.min(intensity, 2.0),
            age: 0, // 0 = fresh, 1 = healed
            size: 30 + Math.random() * 40 * intensity,
            colorPhase: Math.random() * Math.PI * 2, // For color variation
            shape: this.generateBruiseShape()
        };
        
        this.bruises.push(bruise);
        this.redraw();
    }

    generateBruiseShape() {
        // Generate organic blob shape for bruise
        const points = [];
        const segments = 8 + Math.floor(Math.random() * 6);
        
        for (let i = 0; i < segments; i++) {
            const angle = (i / segments) * Math.PI * 2;
            const radius = 0.5 + Math.random() * 0.5;
            points.push({ angle, radius });
        }
        
        return points;
    }

    update(deltaTime) {
        let needsRedraw = false;
        
        this.bruises.forEach(bruise => {
            bruise.age += deltaTime * 0.0001; // Very slow healing
            if (bruise.age < 1) {
                needsRedraw = true;
            }
        });
        
        // Remove fully healed bruises
        this.bruises = this.bruises.filter(b => b.age < 1);
        
        if (needsRedraw) {
            this.redraw();
        }
    }

    redraw() {
        // Base skin
        this.visibleCtx.fillStyle = '#FFDBAC';
        this.visibleCtx.fillRect(0, 0, this.size, this.size);
        
        // Alpha base (fully opaque)
        this.alphaCtx.fillStyle = 'white';
        this.alphaCtx.fillRect(0, 0, this.size, this.size);
        
        // Draw each bruise
        this.bruises.forEach(bruise => {
            this.drawBruise(this.visibleCtx, this.alphaCtx, bruise);
        });
        
        this.updateTextures();
    }

    drawBruise(visCtx, alphaCtx, bruise) {
        const age = bruise.age;
        const intensity = bruise.intensity;
        
        // Bruise color evolution over time
        // Fresh: red/purple -> Blue/purple -> Green/yellow -> Fade
        let r, g, b, a;
        
        if (age < 0.2) {
            // Fresh: reddish purple
            const t = age / 0.2;
            r = 180 + Math.sin(bruise.colorPhase) * 40;
            g = 20 + t * 30;
            b = 60 + Math.cos(bruise.colorPhase) * 40;
            a = 0.7 * intensity * (1 - t * 0.3);
        } else if (age < 0.5) {
            // Blue/purple phase
            const t = (age - 0.2) / 0.3;
            r = 80 - t * 40;
            g = 30 - t * 20;
            b = 120 + t * 40;
            a = 0.8 * intensity * (1 - t * 0.2);
        } else if (age < 0.8) {
            // Green/yellow phase
            const t = (age - 0.5) / 0.3;
            r = 60 + t * 80;
            g = 80 + t * 60;
            b = 20 - t * 15;
            a = 0.6 * intensity * (1 - t * 0.5);
        } else {
            // Fading
            const t = (age - 0.8) / 0.2;
            r = 180;
            g = 160;
            b = 140;
            a = 0.3 * intensity * (1 - t);
        }
        
        const color = `rgba(${Math.floor(r)}, ${Math.floor(g)}, ${Math.floor(b)}, ${a})`;
        const alphaVal = 1 - a * 0.8; // Alpha map: white = opaque, black = transparent
        
        // Draw on visible canvas
        visCtx.save();
        visCtx.translate(bruise.x, bruise.y);
        visCtx.fillStyle = color;
        visCtx.globalCompositeOperation = 'multiply';
        this.drawBruiseShape(visCtx, bruise.shape, bruise.size);
        visCtx.restore();
        
        // Draw on alpha canvas (for transparency)
        alphaCtx.save();
        alphaCtx.translate(bruise.x, bruise.y);
        alphaCtx.fillStyle = `rgba(0, 0, 0, ${a * 0.6})`;
        alphaCtx.globalCompositeOperation = 'source-over';
        this.drawBruiseShape(alphaCtx, bruise.shape, bruise.size);
        alphaCtx.restore();
        
        // Add subtle edge highlight on visible
        visCtx.save();
        visCtx.translate(bruise.x, bruise.y);
        visCtx.strokeStyle = `rgba(${Math.floor(r * 0.7)}, ${Math.floor(g * 0.7)}, ${Math.floor(b * 0.7)}, ${a * 0.5})`;
        visCtx.lineWidth = 2;
        visCtx.globalCompositeOperation = 'overlay';
        this.drawBruiseShape(visCtx, bruise.shape, bruise.size, true);
        visCtx.restore();
    }

    drawBruiseShape(ctx, shape, size, strokeOnly = false) {
        if (shape.length < 3) return;
        
        ctx.beginPath();
        
        // Create smooth organic shape using bezier curves
        for (let i = 0; i < shape.length; i++) {
            const curr = shape[i];
            const next = shape[(i + 1) % shape.length];
            const prev = shape[(i - 1 + shape.length) % shape.length];
            
            const angle = curr.angle;
            const radius = curr.radius * size;
            
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            
            // Control points for smooth curve
            const cp1Angle = (prev.angle + angle) / 2;
            const cp1Radius = (prev.radius + curr.radius) / 2 * size;
            const cp2Angle = (angle + next.angle) / 2;
            const cp2Radius = (curr.radius + next.radius) / 2 * size;
            
            if (i === 0) {
                ctx.moveTo(x, y);
            }
            
            const cp1x = Math.cos(cp1Angle) * cp1Radius;
            const cp1y = Math.sin(cp1Angle) * cp1Radius;
            const cp2x = Math.cos(cp2Angle) * cp2Radius;
            const cp2y = Math.sin(cp2Angle) * cp2Radius;
            
            ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y);
        }
        
        ctx.closePath();
        
        if (strokeOnly) {
            ctx.stroke();
        } else {
            ctx.fill();
        }
    }

    updateTextures() {
        this.visibleTexture.needsUpdate = true;
        this.alphaTexture.needsUpdate = true;
    }

    getVisibleTexture() { return this.visibleTexture; }
    getAlphaTexture() { return this.alphaTexture; }
}

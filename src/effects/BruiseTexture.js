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
        // Transparent base - will blend with dwarf texture
        this.visibleCtx.clearRect(0, 0, this.size, this.size);
        this.visibleCtx.fillStyle = 'rgba(0, 0, 0, 0)';
        this.visibleCtx.fillRect(0, 0, this.size, this.size);
        
        // Alpha starts fully opaque (no bruising = fully visible dwarf texture)
        this.alphaCtx.fillStyle = 'white';
        this.alphaCtx.fillRect(0, 0, this.size, this.size);
        
        this.bruises = [];
        this.updateTextures();
    }

    addBruise(x, y, intensity = 1.0) {
        // Clamp to texture bounds with padding
        x = Math.max(30, Math.min(this.size - 30, x));
        y = Math.max(30, Math.min(this.size - 30, y));
        
        const bruise = {
            x: x,
            y: y,
            intensity: Math.min(intensity, 2.5),
            age: 0, // 0 = fresh, 1 = healed
            size: 25 + Math.random() * 35 * intensity,
            colorPhase: Math.random() * Math.PI * 2,
            shape: this.generateBruiseShape(),
            layers: this.generateBruiseLayers()
        };
        
        this.bruises.push(bruise);
        this.redraw();
    }

    generateBruiseShape() {
        // Generate organic blob shape for bruise
        const points = [];
        const segments = 10 + Math.floor(Math.random() * 8);
        
        for (let i = 0; i < segments; i++) {
            const angle = (i / segments) * Math.PI * 2;
            const radius = 0.4 + Math.random() * 0.6;
            points.push({ angle, radius });
        }
        
        return points;
    }

    generateBruiseLayers() {
        // Multiple layers for realistic bruise depth
        return [
            { scale: 1.0, opacity: 1.0, blur: 0 },      // Core
            { scale: 1.3, opacity: 0.6, blur: 2 },      // Middle
            { scale: 1.6, opacity: 0.3, blur: 4 },      // Outer
            { scale: 2.0, opacity: 0.15, blur: 6 }      // Fade
        ];
    }

    update(deltaTime) {
        let needsRedraw = false;
        
        this.bruises.forEach(bruise => {
            // Very slow healing - bruises last a long time
            bruise.age += deltaTime * 0.00002; 
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
        // Clear visible canvas (transparent)
        this.visibleCtx.clearRect(0, 0, this.size, this.size);
        
        // Alpha base (fully opaque = show dwarf texture)
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
        let r, g, b, a;
        
        if (age < 0.15) {
            // Fresh: bright red/purple
            const t = age / 0.15;
            r = 200 + Math.sin(bruise.colorPhase) * 30;
            g = 30 + t * 20;
            b = 80 + Math.cos(bruise.colorPhase) * 50;
            a = 0.85 * intensity * (1 - t * 0.2);
        } else if (age < 0.35) {
            // Dark purple/blue phase
            const t = (age - 0.15) / 0.2;
            r = 120 - t * 60;
            g = 25 - t * 15;
            b = 140 + t * 40;
            a = 0.9 * intensity * (1 - t * 0.15);
        } else if (age < 0.65) {
            // Blue-green transition
            const t = (age - 0.35) / 0.3;
            r = 60 - t * 30;
            g = 40 + t * 50;
            b = 120 - t * 60;
            a = 0.75 * intensity * (1 - t * 0.25);
        } else if (age < 0.85) {
            // Yellow-green healing
            const t = (age - 0.65) / 0.2;
            r = 80 + t * 100;
            g = 100 + t * 80;
            b = 30 - t * 20;
            a = 0.55 * intensity * (1 - t * 0.4);
        } else {
            // Final fade to brownish
            const t = (age - 0.85) / 0.15;
            r = 160 + t * 40;
            g = 140 + t * 40;
            b = 100 + t * 40;
            a = 0.3 * intensity * (1 - t);
        }
        
        const baseColor = `rgba(${Math.floor(r)}, ${Math.floor(g)}, ${Math.floor(b)}, ${a})`;
        
        // Draw on visible canvas with multiply blending for realistic skin interaction
        visCtx.save();
        visCtx.translate(bruise.x, bruise.y);
        visCtx.globalCompositeOperation = 'multiply';
        
        // Draw multiple layers for depth
        bruise.layers.forEach(layer => {
            visCtx.globalAlpha = layer.opacity * a;
            if (layer.blur > 0) {
                visCtx.shadowColor = baseColor;
                visCtx.shadowBlur = layer.blur;
            } else {
                visCtx.shadowBlur = 0;
            }
            
            visCtx.fillStyle = baseColor;
            this.drawBruiseShape(visCtx, bruise.shape, bruise.size * layer.scale);
        });
        
        visCtx.restore();
        
        // Draw on alpha canvas (black = transparent, white = opaque)
        // We want bruises to make the dwarf texture MORE visible, not less
        // So we don't modify alpha for bruises - they're color overlays
        // But we can add subtle normal map effect via alpha variation
        
        alphaCtx.save();
        alphaCtx.translate(bruise.x, bruise.y);
        alphaCtx.globalCompositeOperation = 'source-over';
        
        // Slight alpha variation for 3D effect
        bruise.layers.forEach(layer => {
            const alphaVal = 1 - (layer.opacity * a * 0.1); // Very subtle
            alphaCtx.globalAlpha = 1 - alphaVal;
            alphaCtx.fillStyle = 'black';
            this.drawBruiseShape(alphaCtx, bruise.shape, bruise.size * layer.scale * 0.8);
        });
        
        alphaCtx.restore();
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

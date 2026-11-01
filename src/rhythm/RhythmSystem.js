import * as THREE from 'three';

export class RhythmSystem {
    constructor(audioEngine) {
        this.audioEngine = audioEngine;
        this.bpm = 70;
        this.beatInterval = 60 / this.bpm; // seconds per beat
        this.tolerance = 0.15; // seconds tolerance for "on beat" (150ms)
        
        // Current beat tracking
        this.currentBeatTime = 0;
        this.nextBeatTime = 0;
        this.lastBeatTime = 0;
        this.beatCount = 0;
        
        // State
        this.isActive = false;
        this.lastClickTime = 0;
        this.consecutiveHits = 0;
        this.requiredHits = 4; // 4 successful hits to shatter
        
        // Callbacks
        this.onHit = null;
        this.onMiss = null;
        this.onShatter = null;
        
        // Visual feedback
        this.beatIndicator = null;
        this.createBeatIndicator();
    }
    
    createBeatIndicator() {
        // Create a subtle visual beat indicator
        const geometry = new THREE.RingGeometry(0.8, 1.0, 32);
        const material = new THREE.MeshBasicMaterial({
            color: 0x00ffff,
            transparent: true,
            opacity: 0,
            side: THREE.DoubleSide,
            depthWrite: false,
        });
        this.beatIndicator = new THREE.Mesh(geometry, material);
        this.beatIndicator.position.z = 2.5;
        this.beatIndicator.rotation.x = -Math.PI / 2;
    }
    
    getBeatIndicator() {
        return this.beatIndicator;
    }
    
    start() {
        this.isActive = true;
        this.beatCount = 0;
        this.consecutiveHits = 0;
        this.scheduleNextBeat();
    }
    
    stop() {
        this.isActive = false;
    }
    
    scheduleNextBeat() {
        if (!this.isActive) return;
        
        const now = this.audioEngine.ctx.currentTime;
        this.lastBeatTime = this.nextBeatTime || now;
        this.nextBeatTime = this.lastBeatTime + this.beatInterval;
        this.beatCount++;
        
        // Visual beat pulse
        this.pulseBeatIndicator();
        
        // Schedule next beat
        setTimeout(() => this.scheduleNextBeat(), this.beatInterval * 1000 * 0.95);
    }
    
    pulseBeatIndicator() {
        if (!this.beatIndicator) return;
        
        const material = this.beatIndicator.material;
        material.opacity = 0.6;
        
        const startTime = performance.now();
        const duration = 200;
        
        const animate = () => {
            const elapsed = performance.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            
            material.opacity = 0.6 * (1 - eased);
            this.beatIndicator.scale.setScalar(1 + eased * 0.5);
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                this.beatIndicator.scale.setScalar(1);
            }
        };
        animate();
    }
    
    // Call this when user clicks on a face
    registerClick(face, texX, texY) {
        if (!this.isActive) return { success: false, reason: 'inactive' };
        
        const now = this.audioEngine.ctx.currentTime;
        this.lastClickTime = now;
        
        // Check if click is within tolerance of a beat
        const timeSinceLastBeat = now - this.lastBeatTime;
        const timeToNextBeat = this.nextBeatTime - now;
        const closestBeatDistance = Math.min(timeSinceLastBeat, timeToNextBeat);
        
        const isOnBeat = closestBeatDistance <= this.tolerance;
        
        if (isOnBeat) {
            this.consecutiveHits++;
            this.onHit?.(face, texX, texY, this.consecutiveHits);
            
            // Check if face should shatter
            if (this.consecutiveHits >= this.requiredHits) {
                this.onShatter?.(face);
                this.consecutiveHits = 0; // Reset for next face
            }
            
            return { success: true, consecutiveHits: this.consecutiveHits };
        } else {
            // Missed the beat - reset progress on this face
            this.consecutiveHits = 0;
            this.onMiss?.(face);
            return { success: false, reason: 'off_beat', distance: closestBeatDistance };
        }
    }
    
    // Reset progress for a specific face (when user misses)
    resetFaceProgress(face) {
        const userData = face.userData;
        userData.clickCount = 0;
        userData.crackTexture.clear();
        this.consecutiveHits = 0;
    }
    
    // Get current rhythm info for UI/debugging
    getRhythmInfo() {
        const now = this.audioEngine.ctx.currentTime;
        return {
            bpm: this.bpm,
            beatInterval: this.beatInterval,
            nextBeatIn: this.nextBeatTime - now,
            beatCount: this.beatCount,
            consecutiveHits: this.consecutiveHits,
            requiredHits: this.requiredHits,
            tolerance: this.tolerance
        };
    }
    
    setCallbacks({ onHit, onMiss, onShatter }) {
        this.onHit = onHit;
        this.onMiss = onMiss;
        this.onShatter = onShatter;
    }
    
    setTolerance(tolerance) {
        this.tolerance = Math.max(0.05, Math.min(0.3, tolerance));
    }
    
    setRequiredHits(hits) {
        this.requiredHits = Math.max(1, Math.min(8, hits));
    }
}

// Factory function for easy integration
export function createRhythmSystem(audioEngine) {
    return new RhythmSystem(audioEngine);
}

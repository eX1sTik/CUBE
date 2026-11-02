import * as THREE from 'three';

export class RhythmSystem {
    constructor(audioEngine) {
        this.audioEngine = audioEngine;
        this.bpm = 70;
        this.beatInterval = 60 / this.bpm; // seconds per beat
        this.tolerance = 0.12; // seconds tolerance for "on beat" (120ms)
        
        // Beat tracking - driven by audio engine events
        this.lastBeatTime = 0;
        this.nextBeatTime = 0;
        this.lastKickBeatTime = 0;
        this.nextKickBeatTime = 0;
        this.beatCount = 0;
        this.measureCount = 0;
        this.isActive = false;
        
        // Visual beat indicator
        this.beatIndicator = null;
        this.indicatorActive = false;
        
        // Subscribe to audio engine beat events
        this.unsubscribeBeat = null;
        this.unsubscribeMeasure = null;
        
        // Callbacks
        this.onHit = null;
        this.onMiss = null;
        this.onShatter = null;
        
        // Required hits to shatter a face
        this.requiredHits = 4;
        this.consecutiveHits = 0;
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
        this.beatIndicator.position.set(0, 0, 0);
        this.beatIndicator.rotation.x = -Math.PI / 2;
        return this.beatIndicator;
    }

    getBeatIndicator() {
        return this.beatIndicator;
    }

    start() {
        this.isActive = true;
        this.beatCount = 0;
        this.measureCount = 0;
        this.consecutiveHits = 0;
        
        // Create visual indicator
        if (!this.beatIndicator) {
            this.createBeatIndicator();
        }
        
        // Subscribe to audio engine beat events
        this.unsubscribeBeat = this.audioEngine.onBeat((beatTime, beatIndex, measureIndex) => {
            if (!this.isActive) return;
            
            this.lastBeatTime = beatTime;
            this.nextBeatTime = beatTime + this.beatInterval;
            this.beatCount = beatIndex + measureIndex * 4;
            this.measureCount = measureIndex;
            
            // Track kick beats (beatIndex 0 and 2 = beats 1 and 3)
            const isKickBeat = beatIndex % 2 === 0;
            if (isKickBeat) {
                this.lastKickBeatTime = beatTime;
                this.nextKickBeatTime = beatTime + this.beatInterval * 2; // Next kick is 2 beats away
            }
            
            // Visual beat pulse (for all beats, but kick beats get special treatment)
            this.pulseBeatIndicator(isKickBeat);
            
            // Call onHit callback if set (for metronome sync)
            if (this.onHit) this.onHit(beatTime, beatIndex, measureIndex, isKickBeat);
        });
        
        this.unsubscribeMeasure = this.audioEngine.onMeasure((measureTime, measureIndex) => {
            if (!this.isActive) return;
            this.measureCount = measureIndex;
        });
        
        // Initialize timing from audio engine
        const timingInfo = this.audioEngine.getTimingInfo();
        if (timingInfo.isPlaying) {
            const now = this.audioEngine.ctx.currentTime;
            const timeSinceStart = now - timingInfo.startTime;
            this.lastBeatTime = timingInfo.startTime + Math.floor(timeSinceStart / this.beatInterval) * this.beatInterval;
            this.nextBeatTime = this.lastBeatTime + this.beatInterval;
            
            // Calculate last/next kick beat
            const beatsSinceStart = Math.floor(timeSinceStart / this.beatInterval);
            const lastKickBeatIndex = beatsSinceStart - (beatsSinceStart % 2);
            this.lastKickBeatTime = timingInfo.startTime + lastKickBeatIndex * this.beatInterval;
            this.nextKickBeatTime = this.lastKickBeatTime + this.beatInterval * 2;
        }
    }

    stop() {
        this.isActive = false;
        if (this.unsubscribeBeat) this.unsubscribeBeat();
        if (this.unsubscribeMeasure) this.unsubscribeMeasure();
        this.unsubscribeBeat = null;
        this.unsubscribeMeasure = null;
        
        if (this.beatIndicator) {
            this.beatIndicator.material.opacity = 0;
        }
    }

    pulseBeatIndicator(isKickBeat) {
        if (!this.beatIndicator) return;
        
        this.indicatorActive = true;
        const material = this.beatIndicator.material;
        material.opacity = isKickBeat ? 0.8 : 0.4;
        material.color.setHex(isKickBeat ? 0x00ff88 : 0x00ffff);
        this.beatIndicator.scale.setScalar(1);
        
        const startTime = performance.now();
        const duration = 200;
        
        const animate = () => {
            if (!this.indicatorActive) return;
            
            const elapsed = performance.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            
            material.opacity = (isKickBeat ? 0.8 : 0.4) * (1 - eased);
            this.beatIndicator.scale.setScalar(1 + eased * (isKickBeat ? 0.8 : 0.4));
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                this.indicatorActive = false;
                material.color.setHex(0x00ffff);
            }
        };
        animate();
    }

    registerClick(face, texX, texY) {
        if (!this.isActive) return { success: false, reason: 'inactive' };
        
        const now = this.audioEngine.ctx.currentTime;
        this.lastClickTime = now;
        
        // Check if click is within tolerance of a KICK beat (not just any beat)
        const timeSinceLastKick = now - this.lastKickBeatTime;
        const timeToNextKick = this.nextKickBeatTime - now;
        const closestKickDistance = Math.min(timeSinceLastKick, timeToNextKick);
        
        const isOnKickBeat = closestKickDistance <= this.tolerance;
        
        if (isOnKickBeat) {
            // Perfect or good timing on kick beat
            const isPerfect = closestKickDistance <= this.tolerance * 0.4;
            
            this.consecutiveHits++;
            
            // Visual feedback for hit
            this.showHitFeedback(face, isPerfect);
            
            if (this.onHit) this.onHit(now, isPerfect, true); // true = on kick beat
            
            return { 
                success: true, 
                perfect: isPerfect, 
                timing: closestKickDistance,
                consecutiveHits: this.consecutiveHits,
                onKickBeat: true
            };
        } else {
            // Missed kick beat
            this.consecutiveHits = 0;
            this.showMissFeedback(face);
            
            if (this.onMiss) this.onMiss(now, closestKickDistance);
            
            return { 
                success: false, 
                reason: 'off_kick_beat', 
                timing: closestKickDistance,
                tolerance: this.tolerance,
                onKickBeat: false
            };
        }
    }

    showHitFeedback(face, perfect) {
        if (!this.beatIndicator) return;
        
        const material = this.beatIndicator.material;
        material.color.setHex(perfect ? 0x00ff88 : 0x00ffff);
        material.opacity = perfect ? 0.9 : 0.7;
        this.beatIndicator.scale.setScalar(perfect ? 1.5 : 1.2);
        
        const startTime = performance.now();
        const duration = 150;
        
        const animate = () => {
            const elapsed = performance.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            
            material.opacity = (perfect ? 0.9 : 0.7) * (1 - eased);
            this.beatIndicator.scale.setScalar((perfect ? 1.5 : 1.2) * (1 - eased * 0.3));
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                material.color.setHex(0x00ffff);
            }
        };
        animate();
    }

    showMissFeedback(face) {
        if (!this.beatIndicator) return;
        
        const material = this.beatIndicator.material;
        material.color.setHex(0xff0000);
        material.opacity = 0.6;
        this.beatIndicator.scale.setScalar(1.3);
        
        const startTime = performance.now();
        const duration = 200;
        
        const animate = () => {
            const elapsed = performance.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            
            material.opacity = 0.6 * (1 - eased);
            this.beatIndicator.scale.setScalar(1.3 * (1 - eased * 0.3));
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                material.color.setHex(0x00ffff);
            }
        };
        animate();
    }

    resetFaceProgress(face) {
        const userData = face.userData;
        userData.clickCount = 0;
        userData.crackTexture.clear();
        this.consecutiveHits = 0;
    }

    getRhythmInfo() {
        const now = this.audioEngine.ctx.currentTime;
        return {
            bpm: this.bpm,
            beatInterval: this.beatInterval,
            lastBeatTime: this.lastBeatTime,
            nextBeatTime: this.nextBeatTime,
            lastKickBeatTime: this.lastKickBeatTime,
            nextKickBeatTime: this.nextKickBeatTime,
            nextKickIn: this.nextKickBeatTime - now,
            beatCount: this.beatCount,
            measureCount: this.measureCount,
            consecutiveHits: this.consecutiveHits,
            requiredHits: this.requiredHits,
            tolerance: this.tolerance,
            isActive: this.isActive
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

export function createRhythmSystem(audioEngine) {
    return new RhythmSystem(audioEngine);
}

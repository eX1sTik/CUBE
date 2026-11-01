import * as THREE from 'three';

export class Metronome {
    constructor(audioEngine) {
        this.audioEngine = audioEngine;
        this.bpm = 70;
        this.beatInterval = 60 / this.bpm; // seconds per beat
        
        // Beat tracking
        this.currentBeat = 0; // 0-3 (for 4 beats per measure)
        this.measureCount = 0;
        this.isActive = false;
        
        // Visual elements
        this.circles = [];
        this.circleGroup = null;
        this.createCircles();
        
        // Sync with audio engine
        this.lastSyncTime = 0;
        this.syncTolerance = 0.05; // 50ms tolerance for sync
    }
    
    createCircles() {
        // Create a group for the circles at the top center
        this.circleGroup = new THREE.Group();
        this.circleGroup.position.set(0, 3.5, 0); // Top of screen
        
        const circleCount = 4;
        const spacing = 0.5;
        const startX = -((circleCount - 1) * spacing) / 2;
        
        for (let i = 0; i < circleCount; i++) {
            // Outer ring
            const ringGeometry = new THREE.RingGeometry(0.18, 0.22, 32);
            const ringMaterial = new THREE.MeshBasicMaterial({
                color: 0x333333,
                transparent: true,
                opacity: 0.4,
                side: THREE.DoubleSide,
                depthWrite: false,
            });
            const ring = new THREE.Mesh(ringGeometry, ringMaterial);
            
            // Inner fill (lights up)
            const fillGeometry = new THREE.CircleGeometry(0.18, 32);
            const fillMaterial = new THREE.MeshBasicMaterial({
                color: 0x00ffff,
                transparent: true,
                opacity: 0,
                side: THREE.DoubleSide,
                depthWrite: false,
            });
            const fill = new THREE.Mesh(fillGeometry, fillMaterial);
            fill.position.z = 0.01; // Slightly in front of ring
            
            const circleContainer = new THREE.Group();
            circleContainer.position.x = startX + i * spacing;
            circleContainer.add(ring);
            circleContainer.add(fill);
            
            // Store references
            circleContainer.userData = {
                index: i,
                ring: ring,
                fill: fill,
                ringMaterial: ringMaterial,
                fillMaterial: fillMaterial,
                isActive: false
            };
            
            this.circles.push(circleContainer);
            this.circleGroup.add(circleContainer);
        }
        
        // Add a label
        const labelGeometry = new THREE.PlaneGeometry(2, 0.25);
        const labelMaterial = new THREE.MeshBasicMaterial({
            color: 0x333333,
            transparent: true,
            opacity: 0.3,
            side: THREE.DoubleSide,
            depthWrite: false,
        });
        const label = new THREE.Mesh(labelGeometry, labelMaterial);
        label.position.y = -0.5;
        this.circleGroup.add(label);
    }
    
    getCircleGroup() {
        return this.circleGroup;
    }
    
    start() {
        this.isActive = true;
        this.currentBeat = 0;
        this.measureCount = 0;
        this.updateCircles();
        
        // Sync with audio engine's next beat
        this.syncWithAudioEngine();
    }
    
    stop() {
        this.isActive = false;
        this.resetCircles();
    }
    
    syncWithAudioEngine() {
        if (!this.isActive) return;
        
        const now = this.audioEngine.ctx.currentTime;
        
        // Calculate when the next beat should occur based on audio engine's schedule
        // The audio engine schedules beats in groups of 4, so we need to find our position
        const timeSinceStart = now - (this.audioEngine.startTime || now);
        const beatsSinceStart = timeSinceStart / this.beatInterval;
        
        // Set current beat based on audio timing
        this.currentBeat = Math.floor(beatsSinceStart) % 4;
        this.measureCount = Math.floor(beatsSinceStart / 4);
        
        this.updateCircles();
        
        // Schedule next beat check
        const nextBeatTime = Math.ceil(beatsSinceStart) * this.beatInterval + (this.audioEngine.startTime || now);
        const delay = Math.max(0, (nextBeatTime - now) * 1000);
        
        setTimeout(() => this.onBeat(), delay);
    }
    
    onBeat() {
        if (!this.isActive) return;
        
        // Advance beat
        this.currentBeat = (this.currentBeat + 1) % 4;
        if (this.currentBeat === 0) {
            this.measureCount++;
        }
        
        this.updateCircles();
        this.pulseCurrentCircle();
        
        // Schedule next beat
        setTimeout(() => this.onBeat(), this.beatInterval * 1000 * 0.995); // Slight adjustment for drift
    }
    
    updateCircles() {
        this.circles.forEach((circleContainer, index) => {
            const { fillMaterial, ringMaterial, fill, ring } = circleContainer.userData;
            
            if (index <= this.currentBeat) {
                // This circle should be lit
                if (!circleContainer.userData.isActive) {
                    circleContainer.userData.isActive = true;
                    this.animateCircleOn(circleContainer);
                }
            } else {
                // This circle should be off
                if (circleContainer.userData.isActive) {
                    circleContainer.userData.isActive = false;
                    this.animateCircleOff(circleContainer);
                }
            }
        });
    }
    
    animateCircleOn(circleContainer) {
        const { fillMaterial, fill } = circleContainer.userData;
        const startTime = performance.now();
        const duration = 150;
        
        const animate = () => {
            const elapsed = performance.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
            
            fillMaterial.opacity = 0.9 * eased;
            fill.scale.setScalar(0.5 + 0.5 * eased);
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };
        animate();
    }
    
    animateCircleOff(circleContainer) {
        const { fillMaterial, fill } = circleContainer.userData;
        const startTime = performance.now();
        const duration = 200;
        
        const animate = () => {
            const elapsed = performance.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = Math.pow(progress, 2); // easeInQuad
            
            fillMaterial.opacity = 0.9 * (1 - eased);
            fill.scale.setScalar(1 - 0.5 * eased);
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                fill.scale.setScalar(0.5);
            }
        };
        animate();
    }
    
    pulseCurrentCircle() {
        // Extra pulse animation on the current beat circle
        const circleContainer = this.circles[this.currentBeat];
        if (!circleContainer) return;
        
        const { fill, ring, fillMaterial, ringMaterial } = circleContainer.userData;
        
        // Pulse the fill
        const startTime = performance.now();
        const duration = this.beatInterval * 1000 * 0.8;
        
        const animatePulse = () => {
            if (!this.isActive) return;
            
            const elapsed = performance.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Breathing effect
            const breath = Math.sin(progress * Math.PI) * 0.15 + 0.85;
            fill.scale.setScalar(breath);
            fillMaterial.opacity = 0.9 * breath;
            
            // Ring also pulses
            ringMaterial.opacity = 0.4 + 0.4 * Math.sin(progress * Math.PI);
            ring.scale.setScalar(1 + 0.1 * Math.sin(progress * Math.PI));
            
            if (progress < 1) {
                requestAnimationFrame(animatePulse);
            } else {
                fill.scale.setScalar(1);
                fillMaterial.opacity = 0.9;
                ring.scale.setScalar(1);
                ringMaterial.opacity = 0.4;
            }
        };
        animatePulse();
    }
    
    resetCircles() {
        this.circles.forEach(circleContainer => {
            const { fillMaterial, fill } = circleContainer.userData;
            fillMaterial.opacity = 0;
            fill.scale.setScalar(0.5);
            circleContainer.userData.isActive = false;
        });
        this.currentBeat = 0;
        this.measureCount = 0;
    }
    
    // Manual beat trigger (for testing or manual sync)
    triggerBeat() {
        this.onBeat();
    }
    
    // Set BPM (updates interval)
    setBPM(bpm) {
        this.bpm = Math.max(30, Math.min(200, bpm));
        this.beatInterval = 60 / this.bpm;
    }
    
    // Get current state
    getState() {
        return {
            currentBeat: this.currentBeat,
            measureCount: this.measureCount,
            bpm: this.bpm,
            isActive: this.isActive
        };
    }
}

// Factory function
export function createMetronome(audioEngine) {
    return new Metronome(audioEngine);
}

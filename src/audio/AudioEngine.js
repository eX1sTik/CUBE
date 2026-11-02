export class AudioEngine {
    constructor() {
        // Don't create AudioContext yet - wait for user gesture
        this.ctx = null;
        this.masterGain = null;
        this.bpm = 70;
        this.beatInterval = 60 / this.bpm;
        
        // Event system for beat synchronization
        this.beatListeners = [];
        this.measureListeners = [];
        this.currentBeat = 0; // 0-3
        this.currentMeasure = 0;
        this.scheduledAheadTime = 0.1; // Schedule 100ms ahead
        this.lookahead = 25; // ms
        this.scheduleIntervalId = null;
        this.isPlaying = false;
        this.startTime = 0;
    }

    ensureAudioContext() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this.masterGain = this.ctx.createGain();
            this.masterGain.connect(this.ctx.destination);
            this.masterGain.gain.value = 0.15;
        }
        return this.ctx;
    }

    resume() {
        this.ensureAudioContext();
        if (this.ctx.state === 'suspended') this.ctx.resume();
    }

    start() {
        this.ensureAudioContext();
        if (this.isPlaying) return;
        this.isPlaying = true;
        this.startTime = this.ctx.currentTime;
        this.currentBeat = 0;
        this.currentMeasure = 0;
        this.scheduledAheadTime = this.ctx.currentTime + 0.1;
        this.scheduler();
    }

    stop() {
        this.isPlaying = false;
        if (this.scheduleIntervalId) {
            clearInterval(this.scheduleIntervalId);
            this.scheduleIntervalId = null;
        }
    }

    // Subscribe to beat events
    onBeat(callback) {
        this.beatListeners.push(callback);
        return () => {
            const idx = this.beatListeners.indexOf(callback);
            if (idx > -1) this.beatListeners.splice(idx, 1);
        };
    }

    // Subscribe to measure (4 beats) events
    onMeasure(callback) {
        this.measureListeners.push(callback);
        return () => {
            const idx = this.measureListeners.indexOf(callback);
            if (idx > -1) this.measureListeners.splice(idx, 1);
        };
    }

    // Emit beat event to all listeners
    emitBeat(beatTime, beatIndex, measureIndex) {
        this.beatListeners.forEach(cb => cb(beatTime, beatIndex, measureIndex));
    }

    emitMeasure(measureTime, measureIndex) {
        this.measureListeners.forEach(cb => cb(measureTime, measureIndex));
    }

    scheduler() {
        if (!this.isPlaying) return;

        const now = this.ctx.currentTime;
        
        // Schedule beats while we're behind
        while (this.scheduledAheadTime < now + this.lookahead / 1000) {
            this.scheduleBeat(this.scheduledAheadTime, this.currentBeat, this.currentMeasure);
            this.scheduledAheadTime += this.beatInterval;
            this.currentBeat = (this.currentBeat + 1) % 4;
            if (this.currentBeat === 0) {
                this.currentMeasure++;
            }
        }

        // Check again in 25ms
        this.scheduleIntervalId = setTimeout(() => this.scheduler(), this.lookahead);
    }

    scheduleBeat(time, beatIndex, measureIndex) {
        // Emit beat event for visual sync (Metronome, RhythmSystem)
        // Use a tiny setTimeout to align with audio thread timing
        const delay = (time - this.ctx.currentTime) * 1000;
        if (delay > -50 && delay < 500) { // Only emit if reasonably close
            setTimeout(() => {
                this.emitBeat(time, beatIndex, measureIndex);
                if (beatIndex === 0) {
                    this.emitMeasure(time, measureIndex);
                }
            }, Math.max(0, delay));
        }

        // Audio: Kick on beats 1 and 3 (0 and 2)
        if (beatIndex % 2 === 0) {
            const kick = this.ctx.createOscillator();
            const kickGain = this.ctx.createGain();
            kick.connect(kickGain);
            kickGain.connect(this.masterGain);
            kick.frequency.setValueAtTime(60, time);
            kick.frequency.exponentialRampToValueAtTime(30, time + 0.8);
            kickGain.gain.setValueAtTime(0.8, time);
            kickGain.gain.exponentialRampToValueAtTime(0.001, time + 0.8);
            kick.start(time);
            kick.stop(time + 1);
        }

        // Pad on beat 1 (downbeat)
        if (beatIndex === 0) {
            this.playPad(time);
        }

        // Hi-hat on beats 2 and 4 (1 and 3)
        if (beatIndex % 2 === 1) {
            this.playHihat(time);
        }
    }

    playPad(time) {
        const frequencies = [65.41, 82.41, 98.00, 130.81];
        frequencies.forEach((freq) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            const filter = this.ctx.createBiquadFilter();
            osc.connect(filter);
            filter.connect(gain);
            gain.connect(this.masterGain);
            
            osc.type = 'sine';
            osc.frequency.value = freq;
            filter.type = 'lowpass';
            filter.frequency.value = 400;
            filter.Q.value = 2;
            
            gain.gain.setValueAtTime(0, time);
            gain.gain.linearRampToValueAtTime(0.05, time + 0.5);
            gain.gain.exponentialRampToValueAtTime(0.001, time + 6);
            
            osc.start(time);
            osc.stop(time + 7);
        });
    }

    playHihat(time) {
        const noise = this.ctx.createBufferSource();
        const bufferSize = this.ctx.sampleRate * 0.03;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * 0.1;
        noise.buffer = buffer;
        
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        
        filter.type = 'highpass';
        filter.frequency.value = 8000;
        gain.gain.setValueAtTime(0.05, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
        
        noise.start(time);
    }

    // Get current timing info
    getTimingInfo() {
        return {
            bpm: this.bpm,
            beatInterval: this.beatInterval,
            currentBeat: this.currentBeat,
            currentMeasure: this.currentMeasure,
            startTime: this.startTime,
            isPlaying: this.isPlaying
        };
    }
}

let audioEngineInstance = null;

export function initAudio() {
    if (!audioEngineInstance) {
        audioEngineInstance = new AudioEngine();
    }
    audioEngineInstance.resume();
    if (!audioEngineInstance.isPlaying) audioEngineInstance.start();
    window.removeEventListener('click', initAudio);
    window.removeEventListener('keydown', initAudio);
}

export function getAudioEngine() {
    if (!audioEngineInstance) {
        audioEngineInstance = new AudioEngine();
    }
    return audioEngineInstance;
}

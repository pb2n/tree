class AudioController {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;

  private getContext() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  playTone(freq: number, type: 'sine' | 'square' | 'sawtooth' | 'triangle', duration: number, volume: number = 0.1) {
    if (this.isMuted) return;
    try {
      const ctx = this.getContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      
      gain.gain.setValueAtTime(volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {
      console.error(e);
    }
  }

  playNoise(duration: number, volume: number = 0.1) {
    if (this.isMuted) return;
    try {
      const ctx = this.getContext();
      const bufferSize = ctx.sampleRate * duration;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
      
      noise.connect(gain);
      gain.connect(ctx.destination);
      
      noise.start();
    } catch (e) {
      console.error(e);
    }
  }

  // --- SFX PRESETS ---

  sfxHover() {
    this.playTone(400, 'sine', 0.05, 0.02);
  }

  sfxSelect() {
    this.playTone(800, 'triangle', 0.1, 0.05);
  }

  sfxRoll() {
    this.playNoise(0.05, 0.05);
  }

  sfxAttack() { 
    // Swoosh sound
    if (this.isMuted) return;
    const ctx = this.getContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.setValueAtTime(600, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.15);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  }

  sfxHit() { 
    this.playNoise(0.15, 0.15);
    this.playTone(100, 'sawtooth', 0.1, 0.1);
  }

  sfxBlock() { 
    this.playTone(150, 'square', 0.2, 0.1); 
  }

  sfxDodge() {
    this.playTone(1200, 'sine', 0.1, 0.05);
    setTimeout(() => this.playTone(2000, 'sine', 0.2, 0.02), 50);
  }

  sfxCrit() {
     this.playTone(800, 'sawtooth', 0.1, 0.1);
     setTimeout(() => this.playNoise(0.3, 0.2), 50);
     setTimeout(() => this.playTone(1200, 'square', 0.3, 0.1), 100);
  }

  sfxHeal() { 
      this.playTone(400, 'sine', 0.3, 0.05); 
      setTimeout(() => this.playTone(600, 'sine', 0.4, 0.05), 150);
      setTimeout(() => this.playTone(800, 'sine', 0.6, 0.05), 300);
  }

  sfxError() {
    this.playTone(150, 'sawtooth', 0.2, 0.1);
  }

  sfxLevelUp() {
    [440, 554, 659, 880].forEach((freq, i) => {
      setTimeout(() => this.playTone(freq, 'triangle', 0.4, 0.1), i * 150);
    });
  }
}

export const audio = new AudioController();
// Web Audio procedural acoustic sound design and soothing ambient soundscape for HomeCraft 3D
// 0MB external assets - purely synthesized, lightweight, and low-latency

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.ambienceGain = null;
    this.ambienceNodes = [];
    this.ambienceActive = false;
    this.enabled = true;
  }

  getAudioContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  // Subtle wooden "tock" on furniture placement (Townscaper inspired)
  playWoodTock() {
    if (!this.enabled) return;
    try {
      const ac = this.getAudioContext();
      if (!ac) return;

      const t = ac.currentTime;
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      const filter = ac.createBiquadFilter();

      osc.type = 'sine';
      // Pitch envelope: drops rapidly from 340Hz to 160Hz for that hollow wooden block feel
      osc.frequency.setValueAtTime(360, t);
      osc.frequency.exponentialRampToValueAtTime(160, t + 0.07);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(700, t);
      filter.frequency.linearRampToValueAtTime(300, t + 0.08);

      gain.gain.setValueAtTime(0.18, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.085);

      osc.connect(filter).connect(gain).connect(ac.destination);
      osc.start(t);
      osc.stop(t + 0.09);

      // Subtle high click layer for texture
      const click = ac.createOscillator();
      const clickGain = ac.createGain();
      click.type = 'triangle';
      click.frequency.setValueAtTime(950, t);
      click.frequency.exponentialRampToValueAtTime(200, t + 0.025);
      clickGain.gain.setValueAtTime(0.08, t);
      clickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
      click.connect(clickGain).connect(ac.destination);
      click.start(t);
      click.stop(t + 0.035);
    } catch (e) {}
  }

  // Soft stone / finish tap on wall surfaces
  playStoneTap() {
    if (!this.enabled) return;
    try {
      const ac = this.getAudioContext();
      if (!ac) return;

      const t = ac.currentTime;
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      const filter = ac.createBiquadFilter();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(640, t);
      osc.frequency.exponentialRampToValueAtTime(320, t + 0.06);

      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1100, t);
      filter.Q.value = 3.0;

      gain.gain.setValueAtTime(0.14, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.065);

      osc.connect(filter).connect(gain).connect(ac.destination);
      osc.start(t);
      osc.stop(t + 0.07);
    } catch (e) {}
  }

  // Gentle whoosh on floor change or view mode switch
  playFloorWhoosh() {
    if (!this.enabled) return;
    try {
      const ac = this.getAudioContext();
      if (!ac) return;

      const t = ac.currentTime;
      const dur = 0.35;
      const bufferSize = ac.sampleRate * dur;
      const buffer = ac.createBuffer(1, bufferSize, ac.sampleRate);
      const data = buffer.getChannelData(0);

      // Soft pink noise
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        data[i] = (b0 + b1 + b2) * 0.3;
      }

      const noise = ac.createBufferSource();
      noise.buffer = buffer;

      const filter = ac.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(180, t);
      filter.frequency.exponentialRampToValueAtTime(750, t + dur * 0.4);
      filter.frequency.exponentialRampToValueAtTime(120, t + dur);

      const gain = ac.createGain();
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.09, t + dur * 0.35);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

      noise.connect(filter).connect(gain).connect(ac.destination);
      noise.start(t);
      noise.stop(t + dur);
    } catch (e) {}
  }

  // Faint crystalline ping when wall snaps to 90 degrees or corner aligns
  playGoldenSnap() {
    if (!this.enabled) return;
    try {
      const ac = this.getAudioContext();
      if (!ac) return;

      const t = ac.currentTime;
      const osc = ac.createOscillator();
      const gain = ac.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, t); // A5 chime
      osc.frequency.exponentialRampToValueAtTime(1760, t + 0.04);

      gain.gain.setValueAtTime(0.06, t);
      gain.gain.exponentialRampToValueAtTime(0.0005, t + 0.18);

      osc.connect(gain).connect(ac.destination);
      osc.start(t);
      osc.stop(t + 0.19);
    } catch (e) {}
  }

  // Procedural soothing summer breeze & warm ambient lo-fi soundscape
  toggleAmbience() {
    if (this.ambienceActive) {
      this.stopAmbience();
      return false;
    } else {
      this.startAmbience();
      return true;
    }
  }

  startAmbience() {
    try {
      const ac = this.getAudioContext();
      if (!ac) return;

      this.stopAmbience();
      this.ambienceActive = true;

      const t = ac.currentTime;
      const master = ac.createGain();
      master.gain.setValueAtTime(0.001, t);
      master.gain.linearRampToValueAtTime(0.12, t + 1.8); // Gentle 1.8s fade in
      master.connect(ac.destination);
      this.ambienceGain = master;

      // 1. Procedural Summer Breeze (filtered white noise + slow sweeping LFO)
      const bufferSize = ac.sampleRate * 2;
      const noiseBuffer = ac.createBuffer(2, bufferSize, ac.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const d = noiseBuffer.getChannelData(ch);
        for (let i = 0; i < bufferSize; i++) {
          d[i] = (Math.random() * 2 - 1) * 0.4;
        }
      }

      const noise = ac.createBufferSource();
      noise.buffer = noiseBuffer;
      noise.loop = true;

      const windFilter = ac.createBiquadFilter();
      windFilter.type = 'lowpass';
      windFilter.frequency.value = 350;
      windFilter.Q.value = 1.8;

      // LFO for breathing wind gust effect
      const lfo = ac.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 0.14; // Once every ~7 seconds
      const lfoGain = ac.createGain();
      lfoGain.gain.value = 220;
      lfo.connect(lfoGain).connect(windFilter.frequency);
      lfo.start();

      noise.connect(windFilter).connect(master);
      noise.start();
      this.ambienceNodes.push(noise, windFilter, lfo, lfoGain);

      // 2. Warm harmonic chord drone (soft pentatonic warmth: C3, G3, E4)
      const freqs = [130.81, 196.00, 329.63];
      freqs.forEach((freq, idx) => {
        const osc = ac.createOscillator();
        const g = ac.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        g.gain.value = 0.025 / (idx + 1);

        // Subtly detune for natural warmth
        osc.detune.value = (idx - 1) * 4;

        osc.connect(g).connect(master);
        osc.start();
        this.ambienceNodes.push(osc, g);
      });

    } catch (e) {
      console.warn('Could not start ambient soundscape', e);
    }
  }

  stopAmbience() {
    if (!this.ambienceActive && !this.ambienceGain) return;
    try {
      if (this.ambienceGain && this.ctx) {
        const t = this.ctx.currentTime;
        this.ambienceGain.gain.linearRampToValueAtTime(0.0001, t + 1.2);
        const nodes = [...this.ambienceNodes];
        setTimeout(() => {
          nodes.forEach(n => {
            try { if (n.stop) n.stop(); n.disconnect(); } catch (_) {}
          });
        }, 1300);
      }
    } catch (e) {}
    this.ambienceNodes = [];
    this.ambienceGain = null;
    this.ambienceActive = false;
  }
}

export const sound = new SoundEngine();

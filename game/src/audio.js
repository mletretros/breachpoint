// Audio engine using Web Audio API exclusively.
// All sounds are synthesized procedurally at runtime. We lazily initialize
// the AudioContext to respect browser autoplay policies, and fail silently
// if audio isn't supported to ensure the game still runs.

export function createAudio() {
  let ctx = null;

  function init() {
    if (!ctx && typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    return ctx;
  }

  // A simple seeded LCG to generate deterministic noise for sound effects,
  // keeping the audio texture consistent across identical game seeds.
  let seed = 12345;
  function lcg() {
    seed = (seed * 1664525 + 1013904223) | 0;
    return (seed >>> 0) / 4294967296;
  }

  // Generate a short burst of white noise into an AudioBuffer.
  function createNoiseBuffer(duration) {
    if (!ctx) return null;
    const frames = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) {
      data[i] = lcg() * 2 - 1;
    }
    return buffer;
  }

  // Small cache of noise buffers so we don't allocate on every shot.
  let noiseCache = {};

  function getNoise(duration) {
    if (!noiseCache[duration]) {
      noiseCache[duration] = createNoiseBuffer(duration);
    }
    return noiseCache[duration];
  }

  // Helper to play a simple oscillator tone with an exponential decay envelope.
  function playTone(freq, type, duration, vol) {
    if (!init()) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + duration);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start(t);
    osc.stop(t + duration);
  }

  function gunshot(kind) {
    if (!init()) return;
    const t = ctx.currentTime;
    
    let duration = 0.2;
    let cutoff = 3000;
    let thumpFreq = 120;
    let noiseVol = 0.8;
    
    // Differentiate weapon acoustics by adjusting envelope, filter, and thump.
    // Pistol: sharp, short crack.
    // SMG: very short, higher pitch crack.
    // Rifle: longer decay, balanced crack and thump.
    // Marksman: longest decay, deep thump, loud crack.
    if (kind === 'pistol') {
      duration = 0.15; cutoff = 4000; thumpFreq = 100;
    } else if (kind === 'smg') {
      duration = 0.12; cutoff = 5000; thumpFreq = 110; noiseVol = 0.6;
    } else if (kind === 'rifle') {
      duration = 0.25; cutoff = 3000; thumpFreq = 150; noiseVol = 1.0;
    } else if (kind === 'marksman') {
      duration = 0.35; cutoff = 2000; thumpFreq = 180; noiseVol = 1.2;
    }

    // High-frequency noise burst for the crack of the shot.
    const noise = ctx.createBufferSource();
    noise.buffer = getNoise(duration);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cutoff, t);
    filter.frequency.exponentialRampToValueAtTime(100, t + duration);
    
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(noiseVol, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, t + duration);
    
    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start(t);
    
    // Low sine thump for the body/kick of the weapon.
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(thumpFreq, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + duration * 0.5);
    
    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0.6, t);
    oscGain.gain.exponentialRampToValueAtTime(0.01, t + duration * 0.8);
    
    osc.connect(oscGain);
    oscGain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + duration);
  }

  function hit() {
    // Short square beep for distinct, artificial hit feedback.
    playTone(800, 'square', 0.05, 0.4);
  }

  function kill() {
    // A descending sine sweep to indicate a target dropping.
    if (!init()) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, t);
    osc.frequency.exponentialRampToValueAtTime(600, t + 0.15);
    
    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.15);
  }

  function reloadClick() {
    // A mechanical-sounding triangle click.
    playTone(600, 'triangle', 0.05, 0.3);
  }

  function step() {
    // Subtle low sine thud for footsteps.
    playTone(80, 'sine', 0.04, 0.15);
  }

  function padBeep() {
    // High-pitched sine beep for the objective pad.
    playTone(1500, 'sine', 0.1, 0.3);
  }

  function roundStart() {
    // Two-note ascending square wave for an alert start.
    if (!init()) return;
    playTone(440, 'square', 0.3, 0.3);
    setTimeout(() => playTone(660, 'square', 0.4, 0.3), 300);
  }

  function roundWin() {
    // Three-note ascending major arpeggio (C5, E5, G5) for victory.
    if (!init()) return;
    playTone(523.25, 'sine', 0.2, 0.4);
    setTimeout(() => playTone(659.25, 'sine', 0.2, 0.4), 200);
    setTimeout(() => playTone(783.99, 'sine', 0.4, 0.4), 400);
  }

  function roundLose() {
    // Three-note descending minor arpeggio (A4, Ab4, G4) for defeat.
    if (!init()) return;
    playTone(440, 'triangle', 0.3, 0.4);
    setTimeout(() => playTone(415.3, 'triangle', 0.3, 0.4), 300);
    setTimeout(() => playTone(392, 'triangle', 0.5, 0.4), 600);
  }

  function transmit() {
    // Rapid, data-like square wave pulses for the uplink transmission.
    if (!init()) return;
    playTone(800, 'square', 0.05, 0.1);
    setTimeout(() => playTone(1200, 'square', 0.05, 0.1), 50);
  }

  return {
    gunshot,
    hit,
    kill,
    reloadClick,
    step,
    padBeep,
    roundStart,
    roundWin,
    roundLose,
    transmit,
    resume() {
      if (ctx && ctx.state === 'suspended') {
        ctx.resume();
      }
    }
  };
}

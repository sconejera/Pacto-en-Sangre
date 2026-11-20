import { computeMusicBeatPulse, findTrimmedSampleRange, pickNextTrackFromDeck } from './rules';

export const SFX_PATHS = {
  puno: '/assets/audio/puno.mp3',
  enemigos: '/assets/audio/enemigos.mp3',
  jefe: '/assets/audio/jefe.mp3',
  jefePeligro: '/src/assets/audio/jefe_peligro.mp3',
  pasesito: '/src/assets/audio/pasesito_bing_bing.mp3',
  ruuun: '/assets/aistudio/RUUUN_e92d817e.mp3',
  matorun: '/assets/aistudio/MATORUN_5c2650ec.mp3',
} as const;

export type SfxKey = keyof typeof SFX_PATHS;

export const MUSIC_TRACKS = [
  '/assets/aistudio/CANCION_PORTADA_JUEGO_1f89a027.mp3',
  '/assets/aistudio/Cris_MJ_-_SI_NO_ES_CONTIGO__Video_Oficial__-_Cris_MJ_e93b24bf.mp3',
  '/assets/aistudio/FANTA_ROSARIO__Pablo_Chill-E_-_PUENTE_ALTO__Video_Oficial__-_FANTA_ROSARIO_e47c7088.mp3',
  '/assets/aistudio/Julianno_Sosa_Ft_BayronFire.oficial_-_LAS_VIBRAS_NO_MIENTEN_-_Julianno_Sosa_1365ff62.mp3',
  '/assets/aistudio/Loyaltty__Marcianeke_Lewis_Somes_-_SEH__Video_Oficial__-_Loyaltty_2913a2db.mp3',
  '/assets/aistudio/Q_Hubo_Amor__Medell_n__-_Ovy_On_The_Drums__Jere_Klein__Blessd__Official_Video__-_Ovy_On_The_Drums_291727ce.mp3',
  '/assets/aistudio/Ya_estoy_Llegando__-_Divino_Ft_Bayron_Fire_prod_by__Boy_wonder_cf_-mati_bomba__-_BAYRON_FIRE_3db553d9.mp3',
] as const;

const SFX_VOLUME: Record<SfxKey, number> = {
  puno: 0.72,
  enemigos: 0.65,
  jefe: 0.72,
  jefePeligro: 0.95,
  pasesito: 0.9,
  ruuun: 0.96,
  matorun: 0.96,
};

const MUSIC_MAX_VOLUME = 0.6;
const DEFAULT_MUSIC_VOLUME = 0.65;
const DEFAULT_SFX_VOLUME = 0.85;

export class GameAudio {
  private ctx: AudioContext | null = null;
  private sfxGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private sfxBuffers: Partial<Record<SfxKey, AudioBuffer>> = {};
  private sfxKeyGains: Partial<Record<SfxKey, GainNode>> = {};
  private rawSfxData: Partial<Record<SfxKey, ArrayBuffer>> = {};
  private sfxPreloadStarted = false;
  private sfxDecoding = false;
  private muted = false;
  private musicVolume = DEFAULT_MUSIC_VOLUME;
  private sfxVolume = DEFAULT_SFX_VOLUME;

  private musicEl: HTMLAudioElement | null = null;
  private musicSourceNode: MediaElementAudioSourceNode | null = null;
  private musicSourceConnected = false;
  private musicAnalyser: AnalyserNode | null = null;
  private musicFreqData: Uint8Array<ArrayBuffer> | null = null;
  private smoothedBass = 0;
  private lastBeatTimeSec = -1;
  private lastBeatLevel = 0;
  private musicDeck: string[] = [];
  private currentTrack: string | null = null;
  private musicShouldPlay = false;
  private pendingMusicRetry = false;
  private musicLoadedTrack: string | null = null;
  private consecutiveTrackErrors = 0;
  private activeFallbackCues = new Set<HTMLAudioElement>();

  private onMusicEnded = (): void => {
    if (this.musicShouldPlay && !this.muted) {
      this.consecutiveTrackErrors = 0;
      this.playRandomTrack();
    }
  };

  private onMusicCanPlay = (): void => {
    this.consecutiveTrackErrors = 0;
    const el = this.musicEl;
    if (el && this.musicShouldPlay && !this.muted && (el.paused || this.pendingMusicRetry)) {
      this.safePlayMusicElement();
    }
  };

  private onMusicError = (): void => {
    if (!this.musicShouldPlay) return;
    this.consecutiveTrackErrors++;
    if (this.consecutiveTrackErrors < MUSIC_TRACKS.length) {
      this.playRandomTrack();
    }
  };

  public preload(): void {
    if (!this.sfxPreloadStarted && typeof fetch !== 'undefined') {
      this.sfxPreloadStarted = true;
      void this.fetchAllSfx();
    }
  }

  private async fetchAllSfx(): Promise<void> {
    const entries = Object.entries(SFX_PATHS) as [SfxKey, string][];
    await Promise.all(
      entries.map(async ([key, url]) => {
        try {
          const res = await fetch(url);
          if (!res.ok) return;
          this.rawSfxData[key] = await res.arrayBuffer();
        } catch {
          // Ignore offline/abort in headless teardown
        }
      })
    );
    await this.decodePendingSfx();
  }

  private async decodePendingSfx(): Promise<void> {
    if (!this.ctx || this.sfxDecoding) return;
    this.sfxDecoding = true;
    try {
      const entries = Object.entries(this.rawSfxData) as [SfxKey, ArrayBuffer][];
      for (const [key, raw] of entries) {
        if (this.sfxBuffers[key] || !raw) continue;
        try {
          const decoded = await this.ctx.decodeAudioData(raw.slice(0));
          const trimThresh = key === 'ruuun' || key === 'matorun' ? 0.004 : 0.012;
          this.sfxBuffers[key] = this.trimAudioBuffer(this.ctx, decoded, trimThresh);
          delete this.rawSfxData[key];
        } catch {
          // Ignore malformed audio in restricted sandboxes
        }
      }
    } finally {
      this.sfxDecoding = false;
    }
  }

  private getNoiseBuffer(): AudioBuffer | null {
    if (!this.ctx) return null;
    if (!this.noiseBuffer) {
      const len = Math.floor(this.ctx.sampleRate * 0.22);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      this.noiseBuffer = buf;
    }
    return this.noiseBuffer;
  }

  /**
   * Trims residual encoder-padded digital silence from the start and end
   * of decoded PCM AudioBuffers so hits begin on sample 0 of the waveform.
   */
  private trimAudioBuffer(ctx: AudioContext, src: AudioBuffer, threshold = 0.012): AudioBuffer {
    const channels = src.numberOfChannels;
    let minStart = src.length;
    let maxEnd = 0;

    for (let ch = 0; ch < channels; ch++) {
      const data = src.getChannelData(ch);
      const { start, end } = findTrimmedSampleRange(data, threshold);
      if (start < minStart) minStart = start;
      if (end > maxEnd) maxEnd = end;
    }

    if (minStart >= maxEnd || (minStart === 0 && maxEnd === src.length)) {
      return src;
    }

    const trimmedLen = Math.max(1, maxEnd - minStart);
    const out = ctx.createBuffer(channels, trimmedLen, src.sampleRate);
    for (let ch = 0; ch < channels; ch++) {
      const srcChan = src.getChannelData(ch);
      const dstChan = out.getChannelData(ch);
      dstChan.set(srcChan.subarray(minStart, minStart + trimmedLen));
    }
    return out;
  }

  public unlock(): void {
    this.preload();
    try {
      if (!this.ctx) {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx();
          this.sfxGain = this.ctx.createGain();
          this.sfxGain.gain.value = this.muted ? 0 : this.sfxVolume;
          this.sfxGain.connect(this.ctx.destination);
          this.ctx.onstatechange = () => {
            if (this.ctx?.state === 'running') {
              this.attachMusicAnalyser();
            }
          };
          void this.decodePendingSfx();
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        void this.ctx
          .resume()
          .then(() => {
            this.attachMusicAnalyser();
          })
          .catch(() => {});
      } else if (this.ctx?.state === 'running') {
        this.attachMusicAnalyser();
      }
      if (this.musicShouldPlay && !this.muted) {
        if (!this.currentTrack || !this.musicEl) {
          this.playRandomTrack();
        } else if (this.musicEl.paused || this.pendingMusicRetry) {
          this.safePlayMusicElement();
        }
      }
    } catch {
      // Headless or blocked audio fallback
    }
  }

  /**
   * Only attaches MediaElementAudioSourceNode once AudioContext is confirmed 'running'
   * so a suspended AudioContext never silences direct <audio> playback.
   */
  private attachMusicAnalyser(): void {
    if (!this.ctx || this.ctx.state !== 'running' || !this.musicEl || this.musicSourceConnected) {
      return;
    }
    try {
      const source = this.ctx.createMediaElementSource(this.musicEl);
      const analyser = this.ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.72;
      source.connect(analyser);
      analyser.connect(this.ctx.destination);
      this.musicSourceNode = source;
      this.musicAnalyser = analyser;
      this.musicFreqData = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));
      this.musicSourceConnected = true;
    } catch {
      // Ignore if media source cannot be attached in restricted sandbox
    }
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    this.lastBeatTimeSec = -1;
    if (this.sfxGain) {
      const targetGain = muted ? 0 : this.sfxVolume;
      this.sfxGain.gain.value = targetGain;
      if (this.ctx) {
        this.sfxGain.gain.cancelScheduledValues(this.ctx.currentTime);
        this.sfxGain.gain.setValueAtTime(targetGain, this.ctx.currentTime);
      }
    }
    for (const cue of this.activeFallbackCues) {
      cue.muted = muted;
      if (muted) {
        cue.pause();
      }
    }
    if (this.musicEl) {
      this.musicEl.muted = muted;
      if (muted) {
        this.pendingMusicRetry = false;
        this.musicEl.pause();
      } else if (this.musicShouldPlay) {
        this.safePlayMusicElement();
      }
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public setMusicVolume(volume: number): void {
    const clamped = Math.max(0, Math.min(1, volume));
    this.musicVolume = clamped;
    if (this.musicEl) {
      this.musicEl.volume = clamped * MUSIC_MAX_VOLUME;
    }
  }

  public getMusicVolume(): number {
    return this.musicVolume;
  }

  public setSfxVolume(volume: number): void {
    const clamped = Math.max(0, Math.min(1, volume));
    this.sfxVolume = clamped;
    if (this.sfxGain && this.ctx) {
      this.sfxGain.gain.setTargetAtTime(this.muted ? 0 : clamped, this.ctx.currentTime, 0.02);
    }
  }

  public getSfxVolume(): number {
    return this.sfxVolume;
  }

  private ensureMusicElement(): HTMLAudioElement | null {
    if (typeof Audio === 'undefined') return null;
    if (!this.musicEl) {
      const el = new Audio();
      // Disable loop so ended fires and advances to another random MP3 track seamlessly
      el.loop = false;
      el.preload = 'auto';
      el.volume = this.musicVolume * MUSIC_MAX_VOLUME;
      el.muted = this.muted;
      el.addEventListener('ended', this.onMusicEnded);
      el.addEventListener('canplay', this.onMusicCanPlay);
      el.addEventListener('error', this.onMusicError);
      this.musicEl = el;
    }
    this.attachMusicAnalyser();
    return this.musicEl;
  }

  private safePlayMusicElement(): void {
    const el = this.musicEl;
    if (!el || !this.musicShouldPlay || this.muted) return;
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {});
    }
    this.pendingMusicRetry = false;
    el.muted = this.muted;
    el.volume = this.musicVolume * MUSIC_MAX_VOLUME;
    try {
      const res = el.play();
      if (res && typeof res.catch === 'function') {
        void res
          .then(() => {
            this.consecutiveTrackErrors = 0;
          })
          .catch(() => {
            this.pendingMusicRetry = true;
          });
      }
    } catch {
      this.pendingMusicRetry = true;
    }
  }

  public getMusicBeatLevel(timeSec: number): number {
    if (timeSec === this.lastBeatTimeSec) {
      return this.lastBeatLevel;
    }
    let measuredBass = 0;
    if (
      !this.muted &&
      this.musicAnalyser &&
      this.musicFreqData &&
      this.musicEl &&
      !this.musicEl.paused &&
      this.ctx &&
      this.ctx.state === 'running'
    ) {
      this.musicAnalyser.getByteFrequencyData(this.musicFreqData);
      let sum = 0;
      const binCount = Math.min(10, this.musicFreqData.length - 1);
      for (let i = 1; i <= binCount; i++) {
        sum += this.musicFreqData[i];
      }
      const avg = binCount > 0 ? sum / binCount : 0;
      const boosted = Math.min(1, Math.pow(avg / 195, 1.3));
      this.smoothedBass =
        boosted > this.smoothedBass
          ? this.smoothedBass * 0.3 + boosted * 0.7
          : this.smoothedBass * 0.82 + boosted * 0.18;
      measuredBass = this.smoothedBass;
    } else {
      this.smoothedBass *= 0.85;
    }
    const level = computeMusicBeatPulse(measuredBass, timeSec, this.muted);
    this.lastBeatTimeSec = timeSec;
    this.lastBeatLevel = level;
    return level;
  }

  public playRandomTrack(): void {
    const pick = pickNextTrackFromDeck(MUSIC_TRACKS, this.musicDeck, this.currentTrack);
    this.musicDeck = pick.nextDeck;
    this.currentTrack = pick.track;
    this.musicShouldPlay = true;

    const el = this.ensureMusicElement();
    if (!el || !pick.track) return;

    if (this.musicLoadedTrack !== pick.track) {
      this.musicLoadedTrack = pick.track;
      el.pause();
      el.src = pick.track;
      el.load();
    } else {
      try {
        el.currentTime = 0;
      } catch {
        // Ignore if metadata not yet loaded
      }
    }
    if (!this.muted) {
      this.safePlayMusicElement();
    }
  }

  public resumeMusic(): void {
    this.musicShouldPlay = true;
    const el = this.ensureMusicElement();
    if (!el) return;
    if (!this.currentTrack || !this.musicLoadedTrack) {
      this.playRandomTrack();
      return;
    }
    if (!this.muted) {
      this.safePlayMusicElement();
    }
  }

  public pauseMusic(): void {
    this.musicShouldPlay = false;
    this.pendingMusicRetry = false;
    if (this.musicEl) {
      this.musicEl.pause();
    }
  }

  public stopMusic(): void {
    this.musicShouldPlay = false;
    this.pendingMusicRetry = false;
    if (this.musicEl) {
      this.musicEl.pause();
      try {
        this.musicEl.currentTime = 0;
      } catch {
        // Ignore if metadata not loaded yet
      }
    }
  }

  public getCurrentTrack(): string | null {
    return this.currentTrack;
  }

  public getMusicDebugState(): {
    currentTrack: string | null;
    paused: boolean;
    shouldPlay: boolean;
    muted: boolean;
    trackCount: number;
  } {
    return {
      currentTrack: this.currentTrack,
      paused: this.musicEl ? this.musicEl.paused : true,
      shouldPlay: this.musicShouldPlay,
      muted: this.muted,
      trackCount: MUSIC_TRACKS.length,
    };
  }

  public playClip(key: SfxKey, delaySec = 0): void {
    if (this.muted || this.sfxVolume <= 0.001) return;
    const buf = this.sfxBuffers[key];
    if (buf && this.ctx && this.sfxGain && this.ctx.state === 'running') {
      try {
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        let keyGain = this.sfxKeyGains[key];
        if (!keyGain) {
          keyGain = this.ctx.createGain();
          keyGain.gain.value = SFX_VOLUME[key];
          keyGain.connect(this.sfxGain);
          this.sfxKeyGains[key] = keyGain;
        }
        src.connect(keyGain);
        src.start(this.ctx.currentTime + delaySec);
        return;
      } catch {
        // Fallback below for voice clips
      }
    } else if (this.rawSfxData[key]) {
      void this.decodePendingSfx();
    }

    // Fallback direct HTMLAudio playback for voice cues when AudioContext is suspended/decoding
    if ((key === 'ruuun' || key === 'matorun') && typeof Audio !== 'undefined') {
      try {
        const cue = new Audio(SFX_PATHS[key]);
        cue.volume = Math.max(0, Math.min(1, SFX_VOLUME[key] * this.sfxVolume));
        cue.muted = this.muted;
        const cleanupCue = () => {
          this.activeFallbackCues.delete(cue);
          cue.removeEventListener('ended', cleanupCue);
          cue.removeEventListener('error', cleanupCue);
        };
        cue.addEventListener('ended', cleanupCue);
        cue.addEventListener('error', cleanupCue);
        this.activeFallbackCues.add(cue);
        void cue.play().catch(cleanupCue);
      } catch {
        // Ignore playback error in restricted context
      }
    }
  }

  public playBoss2Appear(): void {
    this.unlock();
    this.playClip('ruuun', 0);
  }

  public playBoss2Defeat(): void {
    this.unlock();
    this.playClip('matorun', 0);
  }

  public playPlayerHitEnemy(): void {
    this.playClip('puno', 0);
    this.playClip('enemigos', 0.02);
  }

  public playPlayerHitBoss(): void {
    this.playClip('puno', 0);
    this.playClip('jefe', 0.02);
  }

  public playPlayerHitBreakable(): void {
    this.playClip('puno', 0);
  }

  public playEnemyHitPlayer(): void {
    if (this.muted || !this.ctx || !this.sfxGain) return;
    this.playTone(170, 52, 0.14, 'triangle', 0.34, 0);
    this.playTone(115, 42, 0.12, 'sawtooth', 0.16, 0.01);
    const nbuf = this.getNoiseBuffer();
    if (nbuf) {
      try {
        const t0 = this.ctx.currentTime;
        const src = this.ctx.createBufferSource();
        src.buffer = nbuf;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(620, t0);
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.24, t0);
        gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.11);
        src.connect(filter);
        filter.connect(gain);
        gain.connect(this.sfxGain);
        src.start(t0);
        src.stop(t0 + 0.12);
      } catch {
        // Ignore
      }
    }
  }

  public playEnemyThrow(): void {
    if (this.muted || !this.ctx || !this.sfxGain) return;
    this.playTone(460, 210, 0.11, 'sine', 0.15, 0);
    const nbuf = this.getNoiseBuffer();
    if (nbuf) {
      try {
        const t0 = this.ctx.currentTime;
        const src = this.ctx.createBufferSource();
        src.buffer = nbuf;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1400, t0);
        filter.frequency.exponentialRampToValueAtTime(480, t0 + 0.14);
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.18, t0);
        gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.15);
        src.connect(filter);
        filter.connect(gain);
        gain.connect(this.sfxGain);
        src.start(t0);
        src.stop(t0 + 0.16);
      } catch {
        // Ignore
      }
    }
  }

  private playTone(
    freqStart: number,
    freqEnd: number,
    durationSec: number,
    type: OscillatorType,
    volume: number,
    delaySec = 0
  ): void {
    if (this.muted || !this.ctx || !this.sfxGain) return;
    try {
      const t0 = this.ctx.currentTime + delaySec;
      const t1 = t0 + durationSec;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(Math.max(40, freqStart), t0);
      if (freqEnd !== freqStart) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(40, freqEnd), t1);
      }
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.linearRampToValueAtTime(volume, t0 + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, t1);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t0);
      osc.stop(t1 + 0.02);
    } catch {
      // Ignore in restricted environments
    }
  }

  public playMenuMove(): void {
    this.unlock();
    this.playTone(540, 760, 0.055, 'square', 0.14);
  }

  public playMenuConfirm(): void {
    this.unlock();
    this.playTone(587.33, 587.33, 0.06, 'square', 0.18, 0);
    this.playTone(880, 1174.66, 0.11, 'square', 0.2, 0.055);
  }

  public playSelectMove(): void {
    this.unlock();
    this.playTone(330, 495, 0.065, 'sawtooth', 0.16, 0);
    this.playTone(660, 660, 0.045, 'square', 0.11, 0.03);
  }

  public playSelectConfirm(): void {
    this.unlock();
    this.playTone(220, 110, 0.12, 'triangle', 0.28, 0);
    this.playTone(523.25, 523.25, 0.09, 'square', 0.18, 0.02);
    this.playTone(659.25, 659.25, 0.09, 'square', 0.18, 0.08);
    this.playTone(783.99, 1046.5, 0.2, 'square', 0.22, 0.14);
  }

  public playStartGame(): void {
    this.unlock();
    this.playTone(440, 440, 0.07, 'square', 0.2, 0);
    this.playTone(554.37, 554.37, 0.07, 'square', 0.2, 0.07);
    this.playTone(659.25, 659.25, 0.08, 'square', 0.22, 0.14);
    this.playTone(880, 1318.5, 0.24, 'sawtooth', 0.22, 0.21);
  }

  public playBossDangerWarning(): void {
    this.unlock();
    this.playClip('jefePeligro');
    for (let i = 0; i < 3; i++) {
      const base = i * 0.42;
      this.playTone(360, 740, 0.19, 'sawtooth', 0.26, base);
      this.playTone(740, 340, 0.19, 'sawtooth', 0.24, base + 0.19);
      this.playTone(180, 140, 0.16, 'square', 0.14, base);
    }
  }

  public playPickupFood(): void {
    this.unlock();
    this.playTone(523.25, 523.25, 0.06, 'triangle', 0.22, 0);
    this.playTone(659.25, 659.25, 0.06, 'triangle', 0.22, 0.055);
    this.playTone(783.99, 1046.5, 0.14, 'triangle', 0.24, 0.11);
  }

  public playPickupCoin(): void {
    this.unlock();
    this.playTone(987.77, 987.77, 0.06, 'square', 0.17, 0);
    this.playTone(1318.51, 1318.51, 0.18, 'square', 0.18, 0.06);
  }

  public playPickup1Up(): void {
    this.unlock();
    const notes = [329.63, 392.0, 659.25, 523.25, 587.33, 783.99];
    notes.forEach((f, idx) => {
      this.playTone(f, f, 0.08, 'square', 0.19, idx * 0.065);
    });
  }

  public playPickupPowerUp(): void {
    this.unlock();
    this.playClip('pasesito');
  }

  public destroy(): void {
    this.stopMusic();
    if (this.musicEl) {
      this.musicEl.removeEventListener('ended', this.onMusicEnded);
      this.musicEl.removeEventListener('canplay', this.onMusicCanPlay);
      this.musicEl.removeEventListener('error', this.onMusicError);
      this.musicEl.src = '';
      this.musicEl.load();
      this.musicEl = null;
    }
    this.musicLoadedTrack = null;
    this.musicSourceConnected = false;
    try {
      this.musicSourceNode?.disconnect();
    } catch {
      // Ignore disconnect errors on torn-down graph
    }
    this.musicSourceNode = null;
    try {
      this.musicAnalyser?.disconnect();
    } catch {
      // Ignore
    }
    this.musicAnalyser = null;
    this.musicFreqData = null;

    for (const key of Object.keys(this.sfxKeyGains) as SfxKey[]) {
      try {
        this.sfxKeyGains[key]?.disconnect();
      } catch {
        // Ignore
      }
    }
    this.sfxKeyGains = {};
    try {
      this.sfxGain?.disconnect();
    } catch {
      // Ignore
    }
    this.sfxGain = null;
    this.sfxBuffers = {};
    this.rawSfxData = {};
    this.noiseBuffer = null;

    for (const cue of this.activeFallbackCues) {
      cue.pause();
      cue.src = '';
    }
    this.activeFallbackCues.clear();

    if (this.ctx) {
      this.ctx.onstatechange = null;
      void this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }
}

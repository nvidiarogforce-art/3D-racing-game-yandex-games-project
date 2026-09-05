export class EngineAudio {
  private context?: AudioContext;
  private oscillator?: OscillatorNode;
  private gain?: GainNode;
  muted = true;

  async toggle(): Promise<void> {
    this.muted = !this.muted;
    if (!this.muted && !this.context) {
      this.context = new AudioContext();
      this.oscillator = this.context.createOscillator();
      const filter = this.context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 340;
      this.gain = this.context.createGain();
      this.gain.gain.value = 0;
      this.oscillator.type = 'sawtooth';
      this.oscillator.frequency.value = 35;
      this.oscillator.connect(filter);
      filter.connect(this.gain);
      this.gain.connect(this.context.destination);
      this.oscillator.start();
    }
    if (this.context?.state === 'suspended') await this.context.resume();
    this.update(0, false);
  }

  update(speed: number, playing: boolean): void {
    if (!this.context || !this.oscillator || !this.gain) return;
    const time = this.context.currentTime;
    this.oscillator.frequency.setTargetAtTime(32 + Math.abs(speed) * 2.0, time, 0.06);
    this.gain.gain.setTargetAtTime(playing && !this.muted ? 0.035 : 0, time, 0.025);
  }
  dispose(): void {
    this.oscillator?.stop();
    void this.context?.close();
  }
}

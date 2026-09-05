interface YandexSDK {
  features: { LoadingAPI?: { ready(): void }; GameplayAPI?: { start(): void; stop(): void } };
  on?(event: string, listener: () => void): void;
  off?(event: string, listener: () => void): void;
}

declare global {
  interface Window {
    YaGames?: { init(): Promise<YandexSDK> };
  }
}

/** No SDK request in ordinary builds. The Yandex build loads the official host-provided script. */
export class YandexPlatform {
  private sdk?: YandexSDK;
  private active = false;
  private pauseHandler?: () => void;
  private resumeHandler?: () => void;

  async init(): Promise<void> {
    if (import.meta.env.VITE_YANDEX_SDK !== 'true') return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        (async () => {
          if (!window.YaGames)
            await new Promise<void>((resolve, reject) => {
              const script = document.createElement('script');
              script.src = '/sdk.js';
              script.async = true;
              script.onload = () => resolve();
              script.onerror = () => reject(new Error('Could not load the Yandex Games SDK.'));
              document.head.append(script);
            });
          if (!window.YaGames) throw new Error('Yandex Games SDK is unavailable.');
          this.sdk = await window.YaGames.init();
        })(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error('Yandex Games did not respond. Please reload and try again.')),
            15000,
          );
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  }

  ready(): void {
    this.sdk?.features.LoadingAPI?.ready();
  }
  setPlaying(playing: boolean): void {
    if (playing === this.active) return;
    this.active = playing;
    if (playing) this.sdk?.features.GameplayAPI?.start();
    else this.sdk?.features.GameplayAPI?.stop();
  }
  onPauseResume(pause: () => void, resume: () => void): void {
    this.pauseHandler = pause;
    this.resumeHandler = resume;
    this.sdk?.on?.('game_api_pause', pause);
    this.sdk?.on?.('game_api_resume', resume);
  }
  dispose(): void {
    this.setPlaying(false);
    if (this.pauseHandler) this.sdk?.off?.('game_api_pause', this.pauseHandler);
    if (this.resumeHandler) this.sdk?.off?.('game_api_resume', this.resumeHandler);
  }
}

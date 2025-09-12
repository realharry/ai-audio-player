// Offscreen document for audio playback

class OffscreenAudioPlayer {
  private audio: HTMLAudioElement;

  constructor() {
    this.audio = document.getElementById('audioPlayer') as HTMLAudioElement;
    this.setupMessageListener();
    this.setupAudioEventListeners();
  }

  private setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      this.handleMessage(message, sendResponse);
    });
  }

  private setupAudioEventListeners() {
    this.audio.addEventListener('loadedmetadata', () => {
      this.sendStateUpdate();
    });

    this.audio.addEventListener('timeupdate', () => {
      this.sendStateUpdate();
    });

    this.audio.addEventListener('ended', () => {
      this.sendStateUpdate();
      // Notify background script that track ended
      chrome.runtime.sendMessage({ action: 'TRACK_ENDED' });
    });

    this.audio.addEventListener('error', (e) => {
      console.error('Audio error:', e);
      chrome.runtime.sendMessage({ 
        action: 'AUDIO_ERROR', 
        error: this.audio.error?.message 
      });
    });
  }

  private handleMessage(message: any, sendResponse: (response?: any) => void) {
    switch (message.action) {
      case 'PLAY_AUDIO':
        this.playAudio(message.url);
        break;
      case 'PAUSE_AUDIO':
        this.pauseAudio();
        break;
      case 'STOP_AUDIO':
        this.stopAudio();
        break;
      case 'SEEK_AUDIO':
        this.seekAudio(message.time);
        break;
      case 'SET_VOLUME':
        this.setVolume(message.volume);
        break;
      case 'GET_AUDIO_STATE':
        sendResponse(this.getAudioState());
        return;
    }
    sendResponse({ success: true });
  }

  private async playAudio(url: string) {
    try {
      if (this.audio.src !== url) {
        this.audio.src = url;
      }
      await this.audio.play();
    } catch (error) {
      console.error('Failed to play audio:', error);
      chrome.runtime.sendMessage({ 
        action: 'AUDIO_ERROR', 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private pauseAudio() {
    this.audio.pause();
  }

  private stopAudio() {
    this.audio.pause();
    this.audio.currentTime = 0;
  }

  private seekAudio(time: number) {
    this.audio.currentTime = time;
  }

  private setVolume(volume: number) {
    this.audio.volume = Math.max(0, Math.min(1, volume));
  }

  private getAudioState() {
    return {
      currentTime: this.audio.currentTime,
      duration: this.audio.duration || 0,
      volume: this.audio.volume,
      paused: this.audio.paused,
      ended: this.audio.ended,
      src: this.audio.src
    };
  }

  private sendStateUpdate() {
    chrome.runtime.sendMessage({
      action: 'AUDIO_STATE_UPDATE',
      state: this.getAudioState()
    });
  }
}

// Initialize the offscreen audio player
new OffscreenAudioPlayer();
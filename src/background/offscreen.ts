// Offscreen document for audio playback

class OffscreenAudioPlayer {
  private audio: HTMLAudioElement;

  constructor() {
    this.audio = document.getElementById('audioPlayer') as HTMLAudioElement;
    if (!this.audio) {
      console.error('Audio player element not found in offscreen document');
      return;
    }
    this.setupMessageListener();
    this.setupAudioEventListeners();
  }

  private setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      this.handleMessage(message, sendResponse);
    });
  }

  private setupAudioEventListeners() {
    if (!this.audio) return;
    
    this.audio.addEventListener('loadedmetadata', () => {
      this.sendStateUpdate();
    });

    this.audio.addEventListener('timeupdate', () => {
      this.sendStateUpdate();
    });

    this.audio.addEventListener('play', () => {
      this.sendStateUpdate();
    });

    this.audio.addEventListener('pause', () => {
      this.sendStateUpdate();
    });

    this.audio.addEventListener('ended', () => {
      this.sendStateUpdate();
      // Notify background script that track ended
      chrome.runtime.sendMessage({ action: 'TRACK_ENDED' }).catch(error => {
        console.debug('Failed to send track ended message:', error);
      });
    });

    this.audio.addEventListener('error', (e) => {
      console.error('Audio error:', e);
      const errorMessage = this.audio.error ? 
        `Code: ${this.audio.error.code}, Message: ${this.audio.error.message || 'Unknown error'}` :
        'Unknown audio error';
      chrome.runtime.sendMessage({ 
        action: 'AUDIO_ERROR', 
        error: errorMessage 
      }).catch(error => {
        console.debug('Failed to send error message:', error);
      });
    });

    this.audio.addEventListener('volumechange', () => {
      this.sendStateUpdate();
    });

    this.audio.addEventListener('seeking', () => {
      this.sendStateUpdate();
    });

    this.audio.addEventListener('seeked', () => {
      this.sendStateUpdate();
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
    if (!this.audio) {
      console.error('Audio element not available');
      chrome.runtime.sendMessage({ 
        action: 'AUDIO_ERROR', 
        error: 'Audio element not available'
      });
      return;
    }

    try {
      // Clear any existing source first to avoid conflicts
      if (this.audio.src && this.audio.src !== url) {
        this.audio.pause();
        this.audio.currentTime = 0;
      }
      
      this.audio.src = url;
      
      // Wait for the audio to be ready before playing
      await new Promise((resolve, reject) => {
        const onCanPlay = () => {
          this.audio.removeEventListener('canplay', onCanPlay);
          this.audio.removeEventListener('error', onError);
          resolve(void 0);
        };
        
        const onError = (e: Event) => {
          this.audio.removeEventListener('canplay', onCanPlay);
          this.audio.removeEventListener('error', onError);
          reject(e);
        };
        
        this.audio.addEventListener('canplay', onCanPlay);
        this.audio.addEventListener('error', onError);
        
        // Trigger loading
        this.audio.load();
      });
      
      await this.audio.play();
    } catch (error) {
      console.error('Failed to play audio:', error);
      chrome.runtime.sendMessage({ 
        action: 'AUDIO_ERROR', 
        error: error instanceof Error ? error.message : 'Failed to play audio'
      });
    }
  }

  private pauseAudio() {
    if (!this.audio) return;
    this.audio.pause();
  }

  private stopAudio() {
    if (!this.audio) return;
    this.audio.pause();
    this.audio.currentTime = 0;
  }

  private seekAudio(time: number) {
    if (!this.audio) return;
    this.audio.currentTime = time;
  }

  private setVolume(volume: number) {
    if (!this.audio) return;
    this.audio.volume = Math.max(0, Math.min(1, volume));
  }

  private getAudioState() {
    if (!this.audio) {
      return {
        currentTime: 0,
        duration: 0,
        volume: 1,
        paused: true,
        ended: false,
        src: ''
      };
    }
    
    return {
      currentTime: this.audio.currentTime || 0,
      duration: this.audio.duration || 0,
      volume: this.audio.volume || 1,
      paused: this.audio.paused,
      ended: this.audio.ended,
      src: this.audio.src || ''
    };
  }

  private sendStateUpdate() {
    const state = this.getAudioState();
    chrome.runtime.sendMessage({
      action: 'AUDIO_STATE_UPDATE',
      state: state
    }).catch(error => {
      // Ignore errors if background script is not ready
      console.debug('Failed to send state update:', error);
    });
  }
}

// Initialize the offscreen audio player
new OffscreenAudioPlayer();
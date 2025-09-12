// Background script for managing audio playback in Chrome extension

interface AudioState {
  isPlaying: boolean;
  currentTrack: string | null;
  currentTime: number;
  duration: number;
  playlist: AudioTrack[];
  currentIndex: number;
  volume: number;
}

interface AudioTrack {
  id: string;
  name: string;
  url: string;
  duration?: number;
}

class AudioManager {
  private audioState: AudioState = {
    isPlaying: false,
    currentTrack: null,
    currentTime: 0,
    duration: 0,
    playlist: [],
    currentIndex: -1,
    volume: 1.0
  };

  constructor() {
    this.setupMessageListeners();
    this.loadState();
  }

  private setupMessageListeners() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
      return true; // Keep message channel open for async response
    });
  }

  private async handleMessage(message: any, _sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) {
    switch (message.action) {
      case 'PLAY':
        await this.play();
        break;
      case 'PAUSE':
        await this.pause();
        break;
      case 'STOP':
        await this.stop();
        break;
      case 'SEEK':
        await this.seek(message.time);
        break;
      case 'SET_VOLUME':
        await this.setVolume(message.volume);
        break;
      case 'ADD_TRACK':
        await this.addTrack(message.track);
        break;
      case 'REMOVE_TRACK':
        await this.removeTrack(message.trackId);
        break;
      case 'SET_CURRENT_TRACK':
        await this.setCurrentTrack(message.trackId);
        break;
      case 'NEXT_TRACK':
        await this.nextTrack();
        break;
      case 'PREVIOUS_TRACK':
        await this.previousTrack();
        break;
      case 'GET_STATE':
        sendResponse(this.audioState);
        return;
      case 'AUDIO_STATE_UPDATE':
        this.handleAudioStateUpdate(message.state);
        this.broadcastStateUpdate();
        sendResponse({ success: true });
        return;
      case 'TRACK_ENDED':
        await this.handleTrackEnded();
        break;
      case 'AUDIO_ERROR':
        console.error('Audio error received:', message.error);
        this.audioState.isPlaying = false;
        this.broadcastStateUpdate();
        break;
      default:
        console.log('Unknown message action:', message.action);
    }

    sendResponse({ success: true, state: this.audioState });
    this.saveState();
    this.updateBadge();
    this.broadcastStateUpdate();
  }

  private async createOffscreenDocument() {
    if (await this.hasOffscreenDocument()) {
      return;
    }

    await chrome.offscreen.createDocument({
      url: chrome.runtime.getURL('offscreen.html'),
      reasons: [chrome.offscreen.Reason.AUDIO_PLAYBACK],
      justification: 'Playing audio in the background'
    });
  }

  private async hasOffscreenDocument(): Promise<boolean> {
    if ('getContexts' in chrome.runtime) {
      const contexts = await chrome.runtime.getContexts({
        contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT]
      });
      return contexts.length > 0;
    }
    return false;
  }

  private async sendToOffscreen(message: any) {
    if (!await this.hasOffscreenDocument()) {
      await this.createOffscreenDocument();
    }
    return chrome.runtime.sendMessage(message);
  }

  async play() {
    if (this.audioState.currentIndex >= 0 && this.audioState.playlist.length > 0) {
      const track = this.audioState.playlist[this.audioState.currentIndex];
      if (track && track.url) {
        try {
          await this.sendToOffscreen({ action: 'PLAY_AUDIO', url: track.url });
          this.audioState.isPlaying = true;
          this.audioState.currentTrack = track.url;
        } catch (error) {
          console.error('Failed to send play command to offscreen:', error);
          this.audioState.isPlaying = false;
        }
      } else {
        console.warn('Current track has no valid URL');
        this.audioState.isPlaying = false;
      }
    }
  }

  async pause() {
    await this.sendToOffscreen({ action: 'PAUSE_AUDIO' });
    this.audioState.isPlaying = false;
  }

  async stop() {
    await this.sendToOffscreen({ action: 'STOP_AUDIO' });
    this.audioState.isPlaying = false;
    this.audioState.currentTime = 0;
  }

  async seek(time: number) {
    await this.sendToOffscreen({ action: 'SEEK_AUDIO', time });
    this.audioState.currentTime = time;
  }

  async setVolume(volume: number) {
    await this.sendToOffscreen({ action: 'SET_VOLUME', volume });
    this.audioState.volume = volume;
  }

  async addTrack(track: AudioTrack) {
    this.audioState.playlist.push(track);
    if (this.audioState.currentIndex === -1) {
      this.audioState.currentIndex = 0;
    }
  }

  async removeTrack(trackId: string) {
    const index = this.audioState.playlist.findIndex(track => track.id === trackId);
    if (index !== -1) {
      this.audioState.playlist.splice(index, 1);
      // Fix currentIndex if it's out of bounds
      if (this.audioState.currentIndex >= this.audioState.playlist.length) {
        this.audioState.currentIndex = Math.max(0, this.audioState.playlist.length - 1);
      }
      if (this.audioState.playlist.length === 0) {
        this.audioState.currentIndex = -1;
        await this.stop();
      }
    }
  }

  async setCurrentTrack(trackId: string) {
    const index = this.audioState.playlist.findIndex(track => track.id === trackId);
    if (index !== -1) {
      const wasPlaying = this.audioState.isPlaying;
      await this.stop();
      this.audioState.currentIndex = index;
      if (wasPlaying) {
        await this.play();
      }
    }
  }

  async nextTrack() {
    if (this.audioState.playlist.length === 0) return;
    
    const nextIndex = (this.audioState.currentIndex + 1) % this.audioState.playlist.length;
    const wasPlaying = this.audioState.isPlaying;
    await this.stop();
    this.audioState.currentIndex = nextIndex;
    if (wasPlaying) {
      await this.play();
    }
  }

  async previousTrack() {
    if (this.audioState.playlist.length === 0) return;
    
    let prevIndex = this.audioState.currentIndex - 1;
    if (prevIndex < 0) prevIndex = this.audioState.playlist.length - 1;
    
    const wasPlaying = this.audioState.isPlaying;
    await this.stop();
    this.audioState.currentIndex = prevIndex;
    if (wasPlaying) {
      await this.play();
    }
  }

  private handleAudioStateUpdate(audioState: any) {
    if (audioState) {
      this.audioState.currentTime = audioState.currentTime || 0;
      this.audioState.duration = audioState.duration || 0;
      this.audioState.volume = audioState.volume || 1.0;
      // Update playing state based on actual audio element state
      this.audioState.isPlaying = !audioState.paused && !audioState.ended;
    }
  }

  private async handleTrackEnded() {
    this.audioState.isPlaying = false;
    this.audioState.currentTime = 0;
    
    // Auto-play next track if there is one
    if (this.audioState.currentIndex < this.audioState.playlist.length - 1) {
      await this.nextTrack();
    }
  }

  private async broadcastStateUpdate() {
    // Broadcast state update to all listeners (sidepanel)
    try {
      await chrome.runtime.sendMessage({
        action: 'STATE_BROADCAST',
        state: this.audioState
      });
    } catch (error) {
      // Ignore errors if no listeners are active
      console.debug('No active listeners for state broadcast');
    }
  }

  private async loadState() {
    try {
      const result = await chrome.storage.local.get(['audioState']);
      if (result.audioState) {
        // Ensure playlist is always an array
        const savedState = result.audioState;
        if (!Array.isArray(savedState.playlist)) {
          savedState.playlist = [];
        }
        this.audioState = { ...this.audioState, ...savedState };
      }
    } catch (error) {
      console.error('Failed to load audio state:', error);
      // Reset to default state on error
      this.audioState.playlist = [];
      this.audioState.currentIndex = -1;
    }
  }

  private async saveState() {
    try {
      await chrome.storage.local.set({ audioState: this.audioState });
    } catch (error) {
      console.error('Failed to save audio state:', error);
    }
  }

  private async updateBadge() {
    const badgeText = this.audioState.isPlaying ? '▶' : '';
    await chrome.action.setBadgeText({ text: badgeText });
    await chrome.action.setBadgeBackgroundColor({ color: '#4285f4' });
  }
}

// Initialize audio manager
const audioManager = new AudioManager();

// Handle extension icon click - open side panel
chrome.action.onClicked.addListener(async (tab) => {
  if (tab.id) {
    await chrome.sidePanel.open({ tabId: tab.id });
  }
});

// Handle chrome.sidePanel.setPanelBehavior on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});
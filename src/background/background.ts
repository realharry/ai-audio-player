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
      case 'GET_STATE':
        sendResponse(this.audioState);
        return;
      default:
        console.log('Unknown message action:', message.action);
    }

    sendResponse({ success: true, state: this.audioState });
    this.saveState();
    this.updateBadge();
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
      await this.sendToOffscreen({ action: 'PLAY_AUDIO', url: track.url });
      this.audioState.isPlaying = true;
      this.audioState.currentTrack = track.url;
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

  private async loadState() {
    try {
      const result = await chrome.storage.local.get(['audioState']);
      if (result.audioState) {
        this.audioState = { ...this.audioState, ...result.audioState };
      }
    } catch (error) {
      console.error('Failed to load audio state:', error);
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
import React, { useState, useEffect, useCallback } from 'react'

interface AudioTrack {
  id: string;
  name: string;
  url: string;
  duration?: number;
  fileSize?: number; // Size in bytes
}

interface AudioState {
  isPlaying: boolean;
  currentTrack: string | null;
  currentTime: number;
  duration: number;
  playlist: AudioTrack[];
  currentIndex: number;
  volume: number;
  isLoading: boolean;
  isBuffering: boolean;
}

const AudioPlayerApp: React.FC = () => {
  const [audioState, setAudioState] = useState<AudioState>({
    isPlaying: false,
    currentTrack: null,
    currentTime: 0,
    duration: 0,
    playlist: [],
    currentIndex: -1,
    volume: 1.0,
    isLoading: false,
    isBuffering: false
  });

  const [trackName, setTrackName] = useState('');
  const [trackUrl, setTrackUrl] = useState('');

  // Load initial state from background script
  useEffect(() => {
    const loadState = async () => {
      try {
        const response = await chrome.runtime.sendMessage({ action: 'GET_STATE' });
        if (response && response.playlist) {
          setAudioState(response);
        }
      } catch (error) {
        console.error('Failed to load state:', error);
      }
    };

    // Set up message listener for state updates
    const messageListener = (message: any, _sender: chrome.runtime.MessageSender, _sendResponse: (response?: any) => void) => {
      if (message.action === 'STATE_BROADCAST' && message.state && message.state.playlist) {
        setAudioState(message.state);
      }
    };

    chrome.runtime.onMessage.addListener(messageListener);
    loadState();

    // Set up periodic state sync to handle any missed updates
    const intervalId = setInterval(async () => {
      try {
        const response = await chrome.runtime.sendMessage({ action: 'GET_STATE' });
        if (response && response.playlist) {
          setAudioState(response);
        }
      } catch (error) {
        console.debug('Periodic state sync failed:', error);
      }
    }, 1000); // Update every second

    // Cleanup
    return () => {
      chrome.runtime.onMessage.removeListener(messageListener);
      clearInterval(intervalId);
    };
  }, []);

  // Send command to background script
  const sendCommand = useCallback(async (action: string, payload?: any) => {
    try {
      const response = await chrome.runtime.sendMessage({ action, ...payload });
      if (response?.state) {
        setAudioState(response.state);
      }
      return response;
    } catch (error) {
      console.error('Failed to send command:', error);
      // On error, try to refresh state
      try {
        const stateResponse = await chrome.runtime.sendMessage({ action: 'GET_STATE' });
        if (stateResponse) {
          setAudioState(stateResponse);
        }
      } catch (stateError) {
        console.error('Failed to refresh state after error:', stateError);
      }
    }
  }, []);

  const handlePlay = () => sendCommand('PLAY');
  const handlePause = () => sendCommand('PAUSE');
  const handleStop = () => sendCommand('STOP');
  const handleNextTrack = () => sendCommand('NEXT_TRACK');
  const handlePreviousTrack = () => sendCommand('PREVIOUS_TRACK');

  const handleSeek = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const percent = (event.clientX - rect.left) / rect.width;
    const time = percent * audioState.duration;
    sendCommand('SEEK', { time });
  };

  const handleVolumeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const volume = parseFloat(event.target.value);
    sendCommand('SET_VOLUME', { volume });
  };

  const handleAddTrack = async () => {
    if (!trackName.trim() || !trackUrl.trim()) return;

    // Basic URL validation
    try {
      new URL(trackUrl.trim());
    } catch (error) {
      console.error('Invalid URL provided:', trackUrl);
      return;
    }

    const track: AudioTrack = {
      id: Date.now().toString(),
      name: trackName.trim(),
      url: trackUrl.trim()
    };

    await sendCommand('ADD_TRACK', { track });
    setTrackName('');
    setTrackUrl('');
  };

  const handleRemoveTrack = (trackId: string) => {
    sendCommand('REMOVE_TRACK', { trackId });
  };

  const handleSelectTrack = async (trackId: string) => {
    // Provide immediate visual feedback
    const trackIndex = audioState.playlist?.findIndex(track => track.id === trackId) || -1;
    if (trackIndex !== -1 && trackIndex !== audioState.currentIndex) {
      // Update UI immediately for responsiveness
      setAudioState(prev => ({
        ...prev,
        currentIndex: trackIndex,
        currentTime: 0
      }));
      
      // Send command to background
      await sendCommand('SET_CURRENT_TRACK', { trackId });
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Check file size and warn for large files
      const fileSizeInMB = file.size / (1024 * 1024);
      if (fileSizeInMB > 50) {
        const proceed = confirm(
          `This audio file is ${fileSizeInMB.toFixed(1)}MB. Large files may take a while to load and play. ` +
          `For better performance, consider using files smaller than 50MB. Do you want to continue?`
        );
        if (!proceed) {
          // Clear the file input
          event.target.value = '';
          return;
        }
      }
      
      const url = URL.createObjectURL(file);
      const track: AudioTrack = {
        id: Date.now().toString(),
        name: file.name,
        url: url,
        fileSize: file.size
      };
      sendCommand('ADD_TRACK', { track });
    }
  };

  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return '';
    const mb = bytes / (1024 * 1024);
    if (mb < 1) {
      const kb = bytes / 1024;
      return ` (${kb.toFixed(0)}KB)`;
    }
    return ` (${mb.toFixed(1)}MB)`;
  };

  const formatTime = (time: number): string => {
    if (isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const currentTrack = (audioState.currentIndex >= 0 && audioState.playlist && audioState.playlist.length > 0) ? audioState.playlist[audioState.currentIndex] : null;
  const progressPercent = audioState.duration > 0 ? (audioState.currentTime / audioState.duration) * 100 : 0;

  return (
    <div className="audio-player">
      <div className="player-header">
        <h1>AI Audio Player</h1>
      </div>

      <div className="player-content">
        <div className="current-track">
          {currentTrack ? (
            <>
              <div className="track-info">
                <div className="track-name">
                  {currentTrack.name}
                  {audioState.isLoading && <span className="loading-indicator"> ⏳ Loading...</span>}
                  {audioState.isBuffering && <span className="buffering-indicator"> ⏸ Buffering...</span>}
                </div>
                <div className="track-time">
                  {formatTime(audioState.currentTime)} / {formatTime(audioState.duration)}
                </div>
              </div>

              <div className="progress-bar" onClick={handleSeek}>
                <div
                  className="progress-fill"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              <div className="controls">
                <button 
                  className="control-button" 
                  onClick={handlePreviousTrack}
                  disabled={!audioState.playlist || audioState.playlist.length <= 1 || audioState.isLoading}
                >
                  ⏮️
                </button>
                <button 
                  className="control-button" 
                  onClick={handleStop}
                  disabled={audioState.isLoading}
                >
                  ⏹️
                </button>
                <button
                  className="control-button play"
                  onClick={audioState.isPlaying ? handlePause : handlePlay}
                  disabled={audioState.isLoading}
                >
                  {audioState.isLoading ? '⏳' : (audioState.isPlaying ? '⏸️' : '▶️')}
                </button>
                <button 
                  className="control-button" 
                  onClick={handleNextTrack}
                  disabled={!audioState.playlist || audioState.playlist.length <= 1 || audioState.isLoading}
                >
                  ⏭️
                </button>
              </div>
            </>
          ) : (
            <div className="empty-playlist">
              <div className="empty-playlist-text">No track selected</div>
              <div className="empty-playlist-hint">Add tracks to your playlist below</div>
            </div>
          )}
        </div>

        <div className="volume-container">
          <span>🔊</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={audioState.volume}
            onChange={handleVolumeChange}
            className="volume-slider"
          />
        </div>

        <div className="playlist">
          <div className="playlist-header">
            Playlist ({audioState.playlist?.length || 0} tracks)
          </div>

          {audioState.playlist && audioState.playlist.map((track, index) => (
            <div
              key={track.id}
              className={`playlist-item ${index === audioState.currentIndex ? 'active' : ''}`}
              onClick={() => handleSelectTrack(track.id)}
            >
              <div className="playlist-item-info">
                <div className="playlist-item-name">
                  {track.name}
                  {formatFileSize(track.fileSize)}
                  {track.fileSize && track.fileSize > 50 * 1024 * 1024 && (
                    <span className="large-file-warning"> ⚠️</span>
                  )}
                </div>
                <div className="playlist-item-url">{track.url}</div>
              </div>
              <div className="playlist-item-actions">
                <button
                  className="remove-button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveTrack(track.id);
                  }}
                >
                  ✕
                </button>
              </div>
            </div>
          ))}

          {(!audioState.playlist || audioState.playlist.length === 0) && (
            <div className="empty-playlist">
              <div className="empty-playlist-text">Your playlist is empty</div>
              <div className="empty-playlist-hint">Add your first track below</div>
            </div>
          )}
        </div>
      </div>

      <div className="add-track">
        <div className="add-track-form">
          <div className="input-group">
            <label className="input-label">Track Name</label>
            <input
              type="text"
              value={trackName}
              onChange={(e) => setTrackName(e.target.value)}
              placeholder="Enter track name"
              className="input"
            />
          </div>

          <div className="input-group">
            <label className="input-label">Audio URL</label>
            <input
              type="url"
              value={trackUrl}
              onChange={(e) => setTrackUrl(e.target.value)}
              placeholder="https://example.com/audio.mp3"
              className="input"
            />
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="file"
              accept="audio/*"
              onChange={handleFileUpload}
              className="file-input"
              id="file-input"
            />
            <label htmlFor="file-input" className="file-button">
              📁 Upload File
            </label>
            
            <button
              onClick={handleAddTrack}
              disabled={!trackName.trim() || !trackUrl.trim()}
              className="add-button"
            >
              ➕ Add Track
            </button>
          </div>
          
          <div className="performance-tip">
            💡 <strong>Tip:</strong> For best performance, use audio files under 50MB. Large files may take longer to load.
          </div>
        </div>
      </div>
    </div>
  );
};

export default AudioPlayerApp;
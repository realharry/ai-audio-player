import React, { useState, useEffect, useCallback } from 'react'

interface AudioTrack {
  id: string;
  name: string;
  url: string;
  duration?: number;
}

interface AudioState {
  isPlaying: boolean;
  currentTrack: string | null;
  currentTime: number;
  duration: number;
  playlist: AudioTrack[];
  currentIndex: number;
  volume: number;
}

const AudioPlayerApp: React.FC = () => {
  const [audioState, setAudioState] = useState<AudioState>({
    isPlaying: false,
    currentTrack: null,
    currentTime: 0,
    duration: 0,
    playlist: [],
    currentIndex: -1,
    volume: 1.0
  });

  const [trackName, setTrackName] = useState('');
  const [trackUrl, setTrackUrl] = useState('');

  // Load initial state from background script
  useEffect(() => {
    const loadState = async () => {
      try {
        const response = await chrome.runtime.sendMessage({ action: 'GET_STATE' });
        if (response) {
          setAudioState(response);
        }
      } catch (error) {
        console.error('Failed to load state:', error);
      }
    };

    loadState();
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
    }
  }, []);

  const handlePlay = () => sendCommand('PLAY');
  const handlePause = () => sendCommand('PAUSE');
  const handleStop = () => sendCommand('STOP');

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

  const handleSelectTrack = (trackId: string) => {
    sendCommand('SET_CURRENT_TRACK', { trackId });
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      const track: AudioTrack = {
        id: Date.now().toString(),
        name: file.name,
        url: url
      };
      sendCommand('ADD_TRACK', { track });
    }
  };

  const formatTime = (time: number): string => {
    if (isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const currentTrack = audioState.currentIndex >= 0 ? audioState.playlist[audioState.currentIndex] : null;
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
                <div className="track-name">{currentTrack.name}</div>
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
                <button className="control-button" onClick={handleStop}>
                  ⏹️
                </button>
                <button
                  className="control-button play"
                  onClick={audioState.isPlaying ? handlePause : handlePlay}
                >
                  {audioState.isPlaying ? '⏸️' : '▶️'}
                </button>
                <button className="control-button">
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
            Playlist ({audioState.playlist.length} tracks)
          </div>

          {audioState.playlist.map((track, index) => (
            <div
              key={track.id}
              className={`playlist-item ${index === audioState.currentIndex ? 'active' : ''}`}
              onClick={() => handleSelectTrack(track.id)}
            >
              <div className="playlist-item-info">
                <div className="playlist-item-name">{track.name}</div>
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

          {audioState.playlist.length === 0 && (
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
        </div>
      </div>
    </div>
  );
};

export default AudioPlayerApp;
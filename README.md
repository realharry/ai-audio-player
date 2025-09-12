# ai-audio-player
# AI Audio Player

A Chrome extension built with TypeScript, React, and Vite that allows users to play audio files in the background with a sidepanel interface for controls and playlist management.

## Features

- 🎵 **Background Audio Playback**: Audio continues playing even when the sidepanel is closed
- 🎛️ **Full Playback Controls**: Play, pause, stop, seek, and volume control
- 📂 **Multiple Input Methods**: Upload local files or provide URLs to audio sources
- 📋 **Playlist Management**: Add, remove, and organize your audio tracks
- 🎯 **Sidepanel Interface**: Clean, modern UI that opens as a Chrome sidepanel (not popup)
- 🔄 **State Persistence**: Your playlist and settings are saved across browser sessions
- 📊 **Visual Feedback**: Extension icon shows playback status

## Installation

### Development Setup

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd ai-audio-player
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the extension:
   ```bash
   npm run build
   ```

4. Load the extension in Chrome:
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in the top right)
   - Click "Load unpacked"
   - Select the `dist` folder from this project

### Production Build

The extension is built and packaged in the `dist` folder. You can zip this folder to distribute the extension.

## Usage

1. **Opening the Player**: Click the extension icon in the Chrome toolbar to open the sidepanel

2. **Adding Audio Tracks**:
   - **Upload File**: Click "📁 Upload File" to select local audio files
   - **Add URL**: Enter a track name and audio URL, then click "➕ Add Track"

3. **Playback Controls**:
   - Click any track in the playlist to select it
   - Use the play/pause button (▶️/⏸️) to control playback
   - Click the progress bar to seek to specific positions
   - Adjust volume with the volume slider

4. **Playlist Management**:
   - Click the "✕" button next to any track to remove it
   - Tracks are automatically saved and persist across browser sessions

## Development

### Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run type-check` - Run TypeScript type checking
- `npm run preview` - Preview built files

### Architecture

- **Background Script** (`background.js`): Manages audio state and coordinates between components
- **Offscreen Document** (`offscreen.html`): Handles actual audio playback in a hidden document
- **Sidepanel** (`sidepanel.html`): React-based UI for controls and playlist management

### File Structure

```
src/
├── background/
│   ├── background.ts      # Main background script
│   └── offscreen.ts       # Offscreen audio player
├── components/
│   └── AudioPlayerApp.tsx # Main React component
├── sidepanel/
│   ├── sidepanel.html     # Sidepanel HTML template
│   ├── sidepanel.tsx      # Sidepanel entry point
│   └── sidepanel.css      # Styling
└── utils/                 # Utility functions (if needed)
```

## Permissions

The extension requires the following permissions:
- `storage`: To save playlist and settings
- `sidePanel`: To display the sidepanel interface
- `activeTab`: To interact with the active tab
- `offscreen`: To play audio in the background
- Host permissions for `https://*/*` and `http://*/*` to load audio from URLs

## Browser Compatibility

- Chrome 116+ (required for sidepanel API)
- Chromium-based browsers with sidepanel support

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes and ensure tests pass
4. Submit a pull request

## License

This project is licensed under the ISC License - see the LICENSE file for details.

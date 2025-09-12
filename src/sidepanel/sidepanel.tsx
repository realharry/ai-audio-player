import { createRoot } from 'react-dom/client'
import AudioPlayerApp from '../components/AudioPlayerApp'
import './sidepanel.css'

const container = document.getElementById('root')
if (container) {
  const root = createRoot(container)
  root.render(<AudioPlayerApp />)
}
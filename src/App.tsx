import LandingPage from './pages/LandingPage';
import EditorApp from './EditorApp';

export default function App() {
  const path = window.location.pathname;

  // Video background remover editor
  if (path === '/editor' || path.startsWith('/editor/')) {
    return <EditorApp />;
  }

  // BRX RE BG homepage
  return <LandingPage />;
}
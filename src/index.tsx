import ReactDOM from 'react-dom/client';
import { App } from './components/App';
import './index.css';

// Note: StrictMode is disabled because EmulatorJS uses global state
// and doesn't handle double-mounting well
ReactDOM.createRoot(document.getElementById('root')!).render(<App />);

import { createRoot } from 'react-dom/client';
import App from './App';
import { RecoveryBoundary } from './ui/RecoveryBoundary';
import './ui.css';
createRoot(document.getElementById('root')!).render(
  <RecoveryBoundary>
    <App />
  </RecoveryBoundary>,
);

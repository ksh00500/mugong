import { createRoot } from 'react-dom/client';
import '../ui.css';
import '../pvp/pvp.css';
import './raid.css';
import { RaidApp } from './RaidApp';
createRoot(document.getElementById('root')!).render(<RaidApp />);

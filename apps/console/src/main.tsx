import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { I18nProvider, ToastProvider } from '@civiledger/ui';
import '@civiledger/ui/tokens.css';
import '@civiledger/ui/primitives.css';
import { Root } from './App.js';

const root = document.getElementById('root');
if (!root) throw new Error('missing #root');

createRoot(root).render(
  <StrictMode>
    <I18nProvider>
      <ToastProvider>
        <BrowserRouter>
          <Root />
        </BrowserRouter>
      </ToastProvider>
    </I18nProvider>
  </StrictMode>,
);

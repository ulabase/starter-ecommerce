import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { RhAuthProvider, RhCartProvider, RhPaymentsProvider } from '@ulabase/kit-react';
import { App } from './App';
import { consentsOnError } from './consents-signal';
import { environment } from './environments/environment';
import './styles.css';

// One config object for both providers. `payments: true` is what lets the
// adapter touch `/stripe/*` at all — products mode (catalog and orders) would
// work without it, but the flag also keeps subscription state available on a
// service that has both modes on.
//
// `onError` feeds the consents gate. Sharing it with the payments provider is
// deliberate: a `451` on an order is the same refusal as a `451` on
// `/users/me`, and should raise the same overlay rather than surface as a
// checkout failure the buyer cannot act on.
const config = {
  apiBaseUrl: environment.apiUrl,
  payments: true,
  onError: consentsOnError,
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <RhAuthProvider config={config}>
        {/* Must sit inside RhAuthProvider — it reads the user from it. */}
        <RhPaymentsProvider config={config}>
          <RhCartProvider>
            <App />
          </RhCartProvider>
        </RhPaymentsProvider>
      </RhAuthProvider>
    </BrowserRouter>
  </StrictMode>
);

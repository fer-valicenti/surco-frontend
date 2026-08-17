import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from '@tanstack/react-router';
import { getRouter } from './router';
import './styles.css';

// getRouter() ya crea un QueryClient y lo inyecta en el context del router
// (ver router.tsx) — RootComponent en routes/__root.tsx es quien envuelve
// el árbol en QueryClientProvider usando ese mismo client, así que acá no
// hace falta un segundo QueryClientProvider.
const router = getRouter();

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

const rootElement = document.getElementById('root')!;
createRoot(rootElement).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);

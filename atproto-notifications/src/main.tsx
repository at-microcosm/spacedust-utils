import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from "react-router";
import './index.css';
import { App } from './App';
import { Feed } from './pages/Feed';
import { Admin } from './pages/Admin';

createRoot(document.getElementById('root')!).render(
  // <StrictMode>
    <BrowserRouter>
      <App>
        <Routes>
          <Route index element={<Feed />} />
          <Route path="/admin" element={<Admin />} />
        </Routes>
      </App>
    </BrowserRouter>
  // </StrictMode>,
);

import TimeAgo from 'javascript-time-ago'
import en from 'javascript-time-ago/locale/en'
TimeAgo.addDefaultLocale(en)

import React from 'react';
import ReactDOM from 'react-dom/client';
import { Toaster } from 'react-hot-toast';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
    <Toaster
      position="top-right"
      toastOptions={{
        style: {
          background: '#1f2937',
          color: '#fff',
          border: '1px solid #374151',
          borderRadius: '10px',
          fontSize: '14px',
        },
        success: {
          style: {
            background: '#064e3b',
            border: '1px solid #059669',
          },
        },
        error: {
          style: {
            background: '#7f1d1d',
            border: '1px solid #dc2626',
          },
        },
        duration: 4000,
      }}
    />
  </React.StrictMode>
);

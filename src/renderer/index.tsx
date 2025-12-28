import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';

// Global styles with responsive design
const globalStyles = `
  * {
    box-sizing: border-box;
  }

  body {
    margin: 0;
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
      'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
      sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    overflow: hidden;
  }

  #root {
    width: 100vw;
    height: 100vh;
    overflow: hidden;
  }

  button:hover:not(:disabled) {
    opacity: 0.9;
  }

  button:active:not(:disabled) {
    transform: translateY(1px);
  }

  input:focus, select:focus, button:focus {
    outline: 2px solid #007bff;
    outline-offset: 2px;
  }

  /* Responsive scrollbars */
  ::-webkit-scrollbar {
    width: clamp(8px, 1vw, 12px);
    height: clamp(8px, 1vw, 12px);
  }

  ::-webkit-scrollbar-track {
    background: #f1f1f1;
    border-radius: 4px;
  }

  ::-webkit-scrollbar-thumb {
    background: #888;
    border-radius: 4px;
  }

  ::-webkit-scrollbar-thumb:hover {
    background: #555;
  }

  /* Ensure inputs and buttons are responsive */
  input, select, button {
    min-width: 0;
    max-width: 100%;
  }

  /* Prevent text overflow */
  input[type="text"] {
    overflow: hidden;
    text-overflow: ellipsis;
  }
`;

// Inject global styles
const styleSheet = document.createElement('style');
styleSheet.textContent = globalStyles;
document.head.appendChild(styleSheet);

// Render app
const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

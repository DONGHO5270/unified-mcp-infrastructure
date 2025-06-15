import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import './utils/debug-react-init';
import './utils/hmr-cleanup';

// Root element 확인
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Failed to find the root element');
}

// 이미 렌더링된 root가 있는지 확인
if ((rootElement as any)._reactRootContainer) {
  console.warn('React root already exists on element, cleaning up...');
  // React 18에서는 기존 방식이 deprecate되었으므로 새로운 방식 사용
  try {
    const existingRoot = (rootElement as any)._reactRootContainer;
    if (existingRoot && existingRoot.unmount) {
      existingRoot.unmount();
    }
  } catch (e) {
    console.warn('Failed to unmount existing root:', e);
  }
}

const root = ReactDOM.createRoot(rootElement);

// Development 모드에서 HMR 중복 초기화 문제 해결
const renderApp = () => {
  if (process.env.NODE_ENV === 'development') {
    // 개발 모드: StrictMode 비활성화로 중복 초기화 방지
    root.render(<App />);
  } else {
    // 프로덕션 모드: StrictMode 활성화
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  }
};

renderApp();

// HMR support
if ((module as any).hot) {
  (module as any).hot.accept('./App', () => {
    console.log('[HMR] App module updated');
    renderApp();
  });
}

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();

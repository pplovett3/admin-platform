import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { ConfigProvider, theme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import 'antd/dist/reset.css';
import './global.css';
import { Login } from './pages/Login';
import { CourseList } from './pages/CourseList';
import { isLoggedIn } from './utils/api';

const App: React.FC = () => {
  const [loggedIn, setLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 检查是否已登录
    setLoggedIn(isLoggedIn());
    setLoading(false);
  }, []);

  if (loading) {
    return null;
  }

  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: '#667eea',
          borderRadius: 6
        }
      }}
    >
      {loggedIn ? (
        <CourseList onLogout={() => setLoggedIn(false)} />
      ) : (
        <Login onLoginSuccess={() => setLoggedIn(true)} />
      )}
    </ConfigProvider>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(<App />);


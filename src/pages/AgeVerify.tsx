import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { authAPI } from '../services/api';
import WebApp from '@twa-dev/sdk';

const AgeVerify: React.FC = () => {
  const navigate = useNavigate();
  const { setAgeVerified, setUser, user } = useAuthStore();
  const [isLoading, setIsLoading] = React.useState(false);

  const safeAlert = (message: string) => {
    try {
      WebApp.showAlert(message);
    } catch {
      window.alert(message);
    }
  };

  const safeClose = () => {
    try {
      WebApp.close();
    } catch {
      window.close();
    }
  };

  const handleAgeVerification = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const initData = WebApp.initData || (import.meta.env?.VITE_TG_INIT_DATA as string);

      if (initData) {
        try {
          await authAPI.ageVerify(initData);
          setAgeVerified(true);
          safeAlert('Возраст подтвержден!');
          setTimeout(() => navigate('/home', { replace: true }), 100);
          return;
        } catch (e) {
          if (!import.meta.env.DEV) throw e;
        }
      }

      if (import.meta.env.DEV) {
        const response = await authAPI.dev();
        setUser(response.data.user, response.data.token);
        setAgeVerified(true);
        safeAlert('Возраст подтвержден!');
        setTimeout(() => navigate('/home', { replace: true }), 100);
        return;
      }

      throw new Error('No initData available');
    } catch (error) {
      console.error('Age verification error:', error);
      safeAlert('Ошибка подтверждения возраста');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
        <div className="mb-6">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">🔞</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">
            Подтверждение возраста
          </h1>
          <p className="text-gray-600 mb-6">
            Для продолжения работы с магазином электронных сигарет подтвердите, что вам исполнилось 18 лет
          </p>
        </div>

        <div className="space-y-4">
          <button
            onClick={handleAgeVerification}
            disabled={isLoading}
            className="w-full bg-rose-500 hover:bg-rose-600 disabled:bg-gray-300 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200"
          >
            {isLoading ? 'Подтверждение...' : 'Мне исполнилось 18 лет'}
          </button>
          
          <button
            onClick={safeClose}
            className="w-full bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-3 px-6 rounded-lg transition-colors duration-200"
          >
            Мне нет 18 лет
          </button>
        </div>

        <div className="mt-6 p-4 bg-yellow-50 rounded-lg">
          <p className="text-sm text-yellow-800">
            ⚠️ Продажа электронных сигарет лицам младше 18 лет запрещена законом
          </p>
        </div>
      </div>
    </div>
  );
};

export default AgeVerify;

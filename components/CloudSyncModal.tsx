import React, { useState, useEffect } from 'react';
import { Button, Input } from './UI';
import { MockDB, FirebaseConfig } from '../services/mockDatabase';

interface CloudSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigSaved: () => void;
}

export const CloudSyncModal: React.FC<CloudSyncModalProps> = ({ isOpen, onClose, onConfigSaved }) => {
  const [apiKey, setApiKey] = useState('');
  const [authDomain, setAuthDomain] = useState('');
  const [databaseURL, setDatabaseURL] = useState('');
  const [projectId, setProjectId] = useState('');
  const [storageBucket, setStorageBucket] = useState('');
  const [messagingSenderId, setMessagingSenderId] = useState('');
  const [appId, setAppId] = useState('');
  const [status, setStatus] = useState<'IDLE' | 'CONNECTING' | 'CONNECTED' | 'ERROR'>('IDLE');

  useEffect(() => {
    if (isOpen) {
      const storedConfig = localStorage.getItem('firebaseConfig');
      if (storedConfig) {
        const config = JSON.parse(storedConfig);
        setApiKey(config.apiKey || '');
        setAuthDomain(config.authDomain || '');
        setDatabaseURL(config.databaseURL || '');
        setProjectId(config.projectId || '');
        setStorageBucket(config.storageBucket || '');
        setMessagingSenderId(config.messagingSenderId || '');
        setAppId(config.appId || '');
        
        if (MockDB.isCloudEnabled()) {
           setStatus('CONNECTED');
        }
      }
    }
  }, [isOpen]);

  const handlePasteConfig = () => {
     const text = prompt('Dán toàn bộ object config của Firebase vào đây (JSON):');
     if (text) {
        try {
           // Try to fix loose JSON if user pasted JS object
           const fixedText = text.replace(/(['"])?([a-zA-Z0-9_]+)(['"])?:/g, '"$2": ').replace(/'/g, '"');
           const config = JSON.parse(fixedText);
           setApiKey(config.apiKey || '');
           setAuthDomain(config.authDomain || '');
           setDatabaseURL(config.databaseURL || '');
           setProjectId(config.projectId || '');
           setStorageBucket(config.storageBucket || '');
           setMessagingSenderId(config.messagingSenderId || '');
           setAppId(config.appId || '');
        } catch (e) {
           alert('Không thể đọc cấu hình. Vui lòng nhập tay.');
        }
     }
  };

  const handleConnect = async () => {
    setStatus('CONNECTING');
    const config: FirebaseConfig = { apiKey, authDomain, databaseURL, projectId, storageBucket, messagingSenderId, appId };
    
    // Save to local storage
    localStorage.setItem('firebaseConfig', JSON.stringify(config));
    
    // Attempt init
    const success = MockDB.initializeCloud(config);
    if (success) {
       setStatus('CONNECTED');
       // Reload data immediately to reflect cloud state
       onConfigSaved();
       setTimeout(onClose, 1000);
    } else {
       setStatus('ERROR');
    }
  };

  const handleDisconnect = () => {
     MockDB.disconnectCloud();
     localStorage.removeItem('firebaseConfig');
     setStatus('IDLE');
     onConfigSaved();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-stone-900/80 backdrop-blur-sm p-4 animate-fade-in-up">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden border-t-4 border-blue-600 flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-stone-100 bg-blue-50 flex justify-between items-center">
           <div>
              <h2 className="text-xl font-bold text-blue-900">Đồng bộ Đám mây (Realtime)</h2>
              <p className="text-xs text-blue-700">Kết nối Firebase để sử dụng trên nhiều thiết bị</p>
           </div>
           <button onClick={onClose} className="p-2 bg-white rounded-full text-stone-500 hover:text-red-600">✕</button>
        </div>

        <div className="p-6 overflow-y-auto space-y-4">
           {status === 'CONNECTED' ? (
              <div className="text-center py-6">
                 <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">☁️</div>
                 <h3 className="font-bold text-green-700 text-lg">Đã kết nối thành công!</h3>
                 <p className="text-stone-500 text-sm mt-2 mb-6">Dữ liệu của bạn đang được đồng bộ hóa thời gian thực.</p>
                 <Button variant="danger" onClick={handleDisconnect}>Ngắt kết nối / Dùng Local</Button>
              </div>
           ) : (
             <>
               <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-100 text-xs text-yellow-800 mb-4">
                  <p className="font-bold mb-1">Hướng dẫn:</p>
                  1. Truy cập <a href="https://console.firebase.google.com/" target="_blank" className="underline text-blue-600">Firebase Console</a>.<br/>
                  2. Tạo Project mới &gt; Tạo Realtime Database.<br/>
                  3. Vào Project Settings &gt; General &gt; Kéo xuống chọn "Config" (CDN).<br/>
                  4. Copy thông tin và dán vào bên dưới.
               </div>
               
               <div className="flex justify-end mb-2">
                  <button onClick={handlePasteConfig} className="text-xs text-blue-600 font-bold hover:underline">📋 Dán nhanh JSON</button>
               </div>

               <div className="grid grid-cols-2 gap-3">
                 <div className="col-span-2"><Input label="apiKey" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="AIzaSy..." /></div>
                 <div className="col-span-2"><Input label="databaseURL" value={databaseURL} onChange={e => setDatabaseURL(e.target.value)} placeholder="https://...firebaseio.com" /></div>
                 <Input label="authDomain" value={authDomain} onChange={e => setAuthDomain(e.target.value)} />
                 <Input label="projectId" value={projectId} onChange={e => setProjectId(e.target.value)} />
                 <Input label="storageBucket" value={storageBucket} onChange={e => setStorageBucket(e.target.value)} />
                 <Input label="messagingSenderId" value={messagingSenderId} onChange={e => setMessagingSenderId(e.target.value)} />
                 <div className="col-span-2"><Input label="appId" value={appId} onChange={e => setAppId(e.target.value)} /></div>
               </div>

               {status === 'ERROR' && <p className="text-center text-red-600 font-bold text-sm">Kết nối thất bại. Kiểm tra lại cấu hình.</p>}
             </>
           )}
        </div>

        {status !== 'CONNECTED' && (
          <div className="p-4 bg-stone-50 border-t border-stone-100 flex justify-end gap-3">
             <Button variant="secondary" onClick={onClose}>Hủy</Button>
             <Button variant="primary" onClick={handleConnect} isLoading={status === 'CONNECTING'} className="bg-blue-600 border-blue-800 hover:bg-blue-700">
                {status === 'CONNECTING' ? 'Đang kết nối...' : 'Kết nối Cloud'}
             </Button>
          </div>
        )}
      </div>
    </div>
  );
};
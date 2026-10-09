'use client';

import { useEffect, useState, useRef } from 'react';

export default function Home() {
  const [status, setStatus] = useState('جارٍ الاتصال...');
  const [qr, setQr] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const sessionIdRef = useRef<string>('');

  useEffect(() => {
    let sessionId = localStorage.getItem('wa_session_id');
    if (!sessionId) {
      sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('wa_session_id', sessionId);
    }
    sessionIdRef.current = sessionId;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/ws?sessionId=${sessionId}`;
    const socket = new WebSocket(wsUrl);
    socketRef.current = socket;

    socket.onopen = () => {
      console.log('[WS] Connected');
      setStatus('متصل. جارٍ تهيئة WhatsApp...');
    };

    socket.onmessage = (event) => {
      try {
        const update = JSON.parse(event.data);
        console.log('[WS] Update:', update);

        if (update.connection === 'open') {
          setIsConnected(true);
          setStatus('✅ تم الاتصال بنجاح');
        }

        if (update.qr) {
          setQr(update.qr);
          setStatus('امسح رمز QR بـ WhatsApp');
        }

        if (update.pairingCode) {
          setPairingCode(update.pairingCode);
          setStatus('أدخل الكود في هاتفك');
        }
      } catch (err) {
        console.error('[WS] Parse error:', err);
      }
    };

    socket.onclose = () => {
      console.log('[WS] Disconnected');
      setStatus('انقطع الاتصال. جارٍ إعادة المحاولة...');
      setTimeout(() => window.location.reload(), 3000);
    };

    socket.onerror = (err) => {
      console.error('[WS] Error:', err);
      setStatus('خطأ في الاتصال');
    };

    return () => socket.close();
  }, []);

  const requestPairingCode = () => {
    if (!phoneNumber || !socketRef.current) return;
    socketRef.current.send(JSON.stringify({
      type: 'pairing',
      phone: phoneNumber,
    }));
    setStatus('جارٍ توليد الكود...');
  };

  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui', textAlign: 'center', maxWidth: 600, margin: '0 auto' }}>
      <h1 style={{ color: '#00a884' }}>WhatsApp Web</h1>
      <p style={{ color: '#667781', minHeight: 24 }}>{status}</p>

      {isConnected ? (
        <div style={{ color: '#00a884', fontSize: '1.3rem', padding: '2rem' }}>
          ✅ تم ربط جهازك بنجاح!
        </div>
      ) : (
        <>
          {qr && (
            <div style={{ margin: '2rem 0' }}>
              <p>امسح رمز QR:</p>
              <img src={qr} alt="QR" style={{ width: 256, height: 256, border: '4px solid #00a884', borderRadius: 8 }} />
            </div>
          )}

          <div style={{ margin: '2rem 0', padding: '1.5rem', background: '#f0f2f5', borderRadius: 12 }}>
            <p style={{ marginBottom: '1rem' }}>أو أدخل رقم هاتفك للحصول على كود الربط:</p>
            <input
              type="tel"
              placeholder="966512345678"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
              style={{ padding: '0.8rem', fontSize: '1rem', width: '100%', maxWidth: 250, marginBottom: '1rem', borderRadius: 6, border: '1px solid #ccc', textAlign: 'center', direction: 'ltr' }}
            />
            <br />
            <button
              onClick={requestPairingCode}
              style={{ padding: '0.8rem 2rem', fontSize: '1rem', background: '#00a884', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold' }}
            >
              اطلب كود الربط
            </button>
          </div>

          {pairingCode && (
            <div style={{ margin: '2rem 0', padding: '1.5rem', background: '#d9fdd3', borderRadius: 12 }}>
              <p>كود الربط:</p>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', letterSpacing: '0.5rem', direction: 'ltr', marginTop: '0.5rem' }}>
                {pairingCode}
              </div>
            </div>
          )}
        </>
      )}
    </main>
  );
}

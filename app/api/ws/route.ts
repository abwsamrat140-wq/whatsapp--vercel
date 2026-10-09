import { experimental_upgradeWebSocket } from '@vercel/functions';
import { createSession, getSession, deleteSession } from '@/lib/baileys';
import QRCode from 'qrcode';
import type { WebSocket } from 'ws';

export const runtime = 'nodejs';
export const maxDuration = 300;

export function GET(request: Request) {
  return experimental_upgradeWebSocket(async (ws: WebSocket) => {
    const url = new URL(request.url);
    const sessionId = url.searchParams.get('sessionId') || 'default';

    console.log(`[WS] Session: ${sessionId}`);

    // إنشاء جلسة Baileys
    try {
      await createSession(sessionId, async (update: any) => {
        if (ws.readyState !== 1) return;

        if (update.qr) {
          try {
            const qrImage = await QRCode.toDataURL(update.qr);
            ws.send(JSON.stringify({ qr: qrImage, raw: update.qr }));
          } catch (err) {
            console.error('[QR] Error:', err);
          }
          return;
        }

        if (update.connection) {
          ws.send(JSON.stringify({ connection: update.connection }));
          return;
        }

        if (update.type === 'messages') {
          ws.send(JSON.stringify({ type: 'messages', data: update.data }));
          return;
        }
      });
    } catch (err) {
      console.error('[WS] Session creation error:', err);
      ws.send(JSON.stringify({ error: 'Failed to create session' }));
    }

    // معالجة الرسائل من العميل
    ws.on('message', async (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        const sock = getSession(sessionId);

        if (!sock) {
          ws.send(JSON.stringify({ error: 'No active session' }));
          return;
        }

        if (message.type === 'pairing' && message.phone) {
          const cleanPhone = message.phone.replace(/\D/g, '');
          console.log(`[Pairing] Requesting code for ${cleanPhone}`);

          try {
            const code = await sock.requestPairingCode(cleanPhone);
            ws.send(JSON.stringify({ pairingCode: code }));
          } catch (err: any) {
            console.error('[Pairing] Error:', err);
            ws.send(JSON.stringify({ error: 'Failed to get pairing code: ' + err.message }));
          }
        }

        if (message.type === 'send' && message.to && message.text) {
          const jid = message.to.includes('@') ? message.to : `${message.to}@s.whatsapp.net`;
          await sock.sendMessage(jid, { text: message.text });
        }

        if (message.type === 'logout') {
          await deleteSession(sessionId);
          ws.send(JSON.stringify({ loggedOut: true }));
        }
      } catch (err) {
        console.error('[WS] Message error:', err);
      }
    });

    ws.on('close', () => {
      console.log(`[WS] Closed: ${sessionId}`);
    });
  });
}

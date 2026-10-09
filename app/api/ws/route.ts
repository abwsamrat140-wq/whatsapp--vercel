import { experimental_upgradeWebSocket } from '@vercel/functions';
import { createSession, getSession, deleteSession } from '@/lib/baileys';
import QRCode from 'qrcode';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function GET(request: Request) {
  const { response, socket } = experimental_upgradeWebSocket(request);

  const url = new URL(request.url);
  const sessionId = url.searchParams.get('sessionId') || 'default';

  console.log(`[WS] Session: ${sessionId}`);

  try {
    await createSession(sessionId, async (update: any) => {
      if (socket.readyState !== 1) return;

      if (update.qr) {
        try {
          const qrImage = await QRCode.toDataURL(update.qr);
          socket.send(JSON.stringify({ qr: qrImage, raw: update.qr }));
        } catch (err) {
          console.error('[QR] Error:', err);
        }
        return;
      }

      if (update.connection) {
        socket.send(JSON.stringify({ connection: update.connection }));
        return;
      }

      if (update.type === 'messages') {
        socket.send(JSON.stringify({ type: 'messages', data: update.data }));
        return;
      }
    });
  } catch (err) {
    console.error('[WS] Session creation error:', err);
    socket.send(JSON.stringify({ error: 'Failed to create session' }));
  }

  socket.on('message', async (data: Buffer) => {
    try {
      const message = JSON.parse(data.toString());
      const sock = getSession(sessionId);

      if (!sock) {
        socket.send(JSON.stringify({ error: 'No active session' }));
        return;
      }

      if (message.type === 'pairing' && message.phone) {
        const cleanPhone = message.phone.replace(/\D/g, '');
        console.log(`[Pairing] Requesting code for ${cleanPhone}`);

        try {
          const code = await sock.requestPairingCode(cleanPhone);
          socket.send(JSON.stringify({ pairingCode: code }));
        } catch (err: any) {
          console.error('[Pairing] Error:', err);
          socket.send(JSON.stringify({ error: 'Failed to get pairing code: ' + err.message }));
        }
      }

      if (message.type === 'send' && message.to && message.text) {
        const jid = message.to.includes('@') ? message.to : `${message.to}@s.whatsapp.net`;
        await sock.sendMessage(jid, { text: message.text });
      }

      if (message.type === 'logout') {
        await deleteSession(sessionId);
        socket.send(JSON.stringify({ loggedOut: true }));
      }
    } catch (err) {
      console.error('[WS] Message error:', err);
    }
  });

  socket.on('close', () => {
    console.log(`[WS] Closed: ${sessionId}`);
  });

  return response;
}

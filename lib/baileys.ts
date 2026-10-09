import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  makeCacheableSignalKeyStore,
  fetchLatestBaileysVersion,
  Browsers,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';

const sessions = new Map<string, any>();
const logger = pino({ level: 'silent' });

export async function createSession(
  sessionId: string,
  onUpdate: (update: any) => void | Promise<void>
) {
  if (sessions.has(sessionId)) {
    console.log(`[Baileys] Session ${sessionId} already exists`);
    return sessions.get(sessionId);
  }

  const sessionDir = `/tmp/sessions/${sessionId}`;

  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
  const { version, isLatest } = await fetchLatestBaileysVersion();

  console.log(`[Baileys] WA v${version.join('.')}, isLatest: ${isLatest}`);

  const sock = makeWASocket({
    version,
    logger,
    printQRInTerminal: false,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    browser: Browsers.ubuntu('Chrome'),
    generateHighQualityLinkPreview: false,
    syncFullHistory: false,
    markOnlineOnConnect: false,
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log(`[Baileys] QR generated for ${sessionId}`);
      onUpdate({ qr });
    }

    if (connection) {
      console.log(`[Baileys] Connection: ${connection}`);
      onUpdate({ connection });
    }

    if (connection === 'close') {
      const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

      console.log(`[Baileys] Closed (code: ${statusCode}, reconnect: ${shouldReconnect})`);

      sessions.delete(sessionId);

      if (shouldReconnect) {
        setTimeout(() => {
          createSession(sessionId, onUpdate).catch(console.error);
        }, 3000);
      }
    }
  });

  sock.ev.on('messages.upsert', (m) => {
    onUpdate({ type: 'messages', data: m });
  });

  sessions.set(sessionId, sock);
  return sock;
}

export function getSession(sessionId: string) {
  return sessions.get(sessionId);
}

export async function deleteSession(sessionId: string) {
  const sock = sessions.get(sessionId);
  if (sock) {
    try {
      await sock.logout();
    } catch (e) {
      console.error('[Baileys] Logout error:', e);
    }
    sessions.delete(sessionId);
  }
}

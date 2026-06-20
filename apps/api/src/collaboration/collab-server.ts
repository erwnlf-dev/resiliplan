import { Server } from '@hocuspocus/server';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

const COLLAB_PORT = Number(process.env.COLLAB_PORT ?? 3002);
const COLLAB_HOST = process.env.COLLAB_HOST ?? '127.0.0.1';

export function buildCollaborationServer() {
  return new Server({
    port: COLLAB_PORT,
    address: COLLAB_HOST,
    name: `${config.APP_NAME} Collaboration`,
    async onConnect(data: { documentName: string }) {
      logger.info({ documentName: data.documentName }, 'Collaboration client connected');
    },
    async onDisconnect(data: { documentName: string }) {
      logger.info({ documentName: data.documentName }, 'Collaboration client disconnected');
    },
  });
}

async function start() {
  const server = buildCollaborationServer();
  await server.listen();
  logger.info({ host: COLLAB_HOST, port: COLLAB_PORT }, 'ResiliPlan collaboration server started');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  start().catch((err) => {
    logger.fatal({ err }, 'Failed to start collaboration server');
    process.exit(1);
  });
}

// PM2 Ecosystem Configuration for ResiliPlan Production
// Usage:
//   pm2 start ecosystem.config.js --env production
//   pm2 save
//   pm2 startup

const cwd = '/home/erwin.alifiansyah/ITResilience_Prod/ResiliPlan';

module.exports = {
  apps: [
    {
      name: 'resiliplan-api',
      script: 'apps/api/dist/server.js',
      cwd,
      instances: 1,
      exec_mode: 'fork',
      env_production: {
        NODE_ENV: 'production',
      },
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 3000,
      error_file: './logs/api-error.log',
      out_file: './logs/api-out.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      max_memory_restart: '512M',
      watch: false,
      ignore_watch: ['node_modules', 'logs', '.git'],
    },
    {
      name: 'resiliplan-web',
      script: 'node_modules/vite/bin/vite.js',
      args: 'preview --host 0.0.0.0 --port 5173',
      cwd: `${cwd}/apps/web`,
      instances: 1,
      exec_mode: 'fork',
      env_production: {
        NODE_ENV: 'production',
      },
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 3000,
      error_file: './logs/web-error.log',
      out_file: './logs/web-out.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      max_memory_restart: '256M',
      watch: false,
      ignore_watch: ['node_modules', 'logs', '.git'],
    },
    {
      name: 'resiliplan-collab',
      script: 'apps/api/dist/collaboration/collab-server.js',
      cwd,
      instances: 1,
      exec_mode: 'fork',
      env_production: {
        NODE_ENV: 'production',
        COLLAB_HOST: '0.0.0.0',
        COLLAB_PORT: '3002',
      },
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 3000,
      error_file: './logs/collab-error.log',
      out_file: './logs/collab-out.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      max_memory_restart: '256M',
      watch: false,
      ignore_watch: ['node_modules', 'logs', '.git'],
    },
  ],
};

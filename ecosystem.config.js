// PM2 Ecosystem Configuration for ResiliPlan Production
// Usage:
//   pm2 start ecosystem.config.js
//   pm2 save
//   pm2 startup

module.exports = {
  apps: [
    {
      name: 'resiliplan-api',
      script: 'apps/api/dist/server.js',
      cwd: '/opt/resiliplan',
      instances: 1,
      exec_mode: 'fork',
      env_production: {
        NODE_ENV: 'production',
      },
      // Auto-restart settings
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 3000,
      // Log settings
      error_file: '/var/log/resiliplan/api-error.log',
      out_file: '/var/log/resiliplan/api-out.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      // Memory limit (restart if exceeds)
      max_memory_restart: '512M',
      // Watch settings (disable in production)
      watch: false,
      ignore_watch: ['node_modules', 'logs', '.git'],
    },
    {
      name: 'resiliplan-web',
      script: 'pnpm',
      args: '--filter @resiliplan/web preview --host 127.0.0.1 --port 5173',
      cwd: '/opt/resiliplan',
      instances: 1,
      exec_mode: 'fork',
      env_production: {
        NODE_ENV: 'production',
      },
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 3000,
      error_file: '/var/log/resiliplan/web-error.log',
      out_file: '/var/log/resiliplan/web-out.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      max_memory_restart: '256M',
      watch: false,
      ignore_watch: ['node_modules', 'logs', '.git'],
    },
    {
      name: 'resiliplan-collab',
      script: 'apps/api/dist/collaboration/collab-server.js',
      cwd: '/opt/resiliplan',
      instances: 1,
      exec_mode: 'fork',
      env_production: {
        NODE_ENV: 'production',
      },
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 3000,
      error_file: '/var/log/resiliplan/collab-error.log',
      out_file: '/var/log/resiliplan/collab-out.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      max_memory_restart: '256M',
      watch: false,
      ignore_watch: ['node_modules', 'logs', '.git'],
    },
  ],
};

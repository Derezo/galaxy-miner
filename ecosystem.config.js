module.exports = {
  apps: [{
    name: 'galaxy-miner',
    script: './server/index.js',
    instances: 1,
    exec_mode: 'fork',

    // Environment
    env: {
      NODE_ENV: 'production',
      PORT: 3388
    },

    // Memory management
    max_memory_restart: '1500M',

    // Logging
    error_file: '/var/www/galaxy-miner/logs/pm2-error.log',
    out_file: '/var/www/galaxy-miner/logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,

    // Process management
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s',
    listen_timeout: 5000,
    kill_timeout: 5000,

    // Restart on file changes (disabled in production)
    watch: false,

    // Advanced features
    instance_var: 'INSTANCE_ID',
    combine_logs: true,

    // Graceful shutdown
    wait_ready: false,
    shutdown_with_message: true,

    // Cron restart daily at 4 AM
    cron_restart: '0 4 * * *',

    // Restart delay with exponential backoff
    exp_backoff_restart_delay: 100
  }]
};

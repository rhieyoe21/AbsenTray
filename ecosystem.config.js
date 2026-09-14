// PM2 ecosystem — production process manager config.
// Penggunaan: pm2 start ecosystem.config.js && pm2 save && pm2 startup
// Aplikasi:
//   absentray-api : Express + Socket.IO   (port 5000)
//   absentray-web : static dist client    (port 3000)
module.exports = {
  apps: [
    {
      name: 'absentray-api',
      cwd: './server',
      script: 'server.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '400M',
      time: true,
      env: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 'absentray-web',
      cwd: './client',
      script: 'serve',
      env: {
        PM2_SERVE_PATH: './dist',
        PM2_SERVE_PORT: 3000,
        PM2_SERVE_SPA: 'true'
      },
      interpreter: 'none',
      autorestart: true
    }
  ]
}
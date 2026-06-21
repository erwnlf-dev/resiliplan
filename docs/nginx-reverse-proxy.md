# Nginx Reverse Proxy for ResiliPlan

Config: /etc/nginx/sites-available/resiliplan.conf (symlinked to sites-enabled)

Listen: 0.0.0.0:8080

Routing:
- /         → static web (apps/web/dist, SPA fallback to index.html)
- /api/     → proxy_pass to 127.0.0.1:3001
- /collab   → proxy_pass to 127.0.0.1:3002 (WebSocket upgrade)

Public access:
- http://38.47.90.90:8080/   (public)
- http://10.220.20.1:8080/   (internal)

Reload:
  sudo nginx -t && sudo systemctl reload nginx

Logs:
  tail -f /var/log/nginx/access.log
  tail -f /var/log/nginx/error.log

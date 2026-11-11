#!/usr/bin/env bash
# Instala o Eixo como serviço num servidor Linux (systemd). Liga sozinho quando o servidor reinicia.
#   sudo bash instalar-servidor.sh          # porta 8080
#   sudo bash instalar-servidor.sh 9000     # outra porta
set -euo pipefail
PORT="${1:-8080}"
SRC="$(cd "$(dirname "$0")" && pwd)"

[ "$(id -u)" = 0 ] || { echo "Rode com sudo: sudo bash $0"; exit 1; }
command -v python3 >/dev/null || { echo "Falta o Python 3. Instale com: apt install python3  (ou dnf install python3)"; exit 1; }
command -v systemctl >/dev/null || { echo "Este servidor não usa systemd. Rode direto: python3 server.py --port $PORT"; exit 1; }

mkdir -p /opt/eixo
cp "$SRC"/{index.html,styles.css,app.js,sw.js,manifest.webmanifest,icon.svg,icon-192.png,icon-512.png,server.py} /opt/eixo/

cat > /etc/systemd/system/eixo.service <<EOF
[Unit]
Description=Eixo - vida organizada
After=network-online.target
Wants=network-online.target

[Service]
ExecStart=/usr/bin/env python3 /opt/eixo/server.py --port $PORT --dados /var/lib/eixo
DynamicUser=yes
StateDirectory=eixo
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable eixo >/dev/null 2>&1
systemctl restart eixo

# libera a porta se houver firewall ativo
if command -v ufw >/dev/null && ufw status 2>/dev/null | grep -q "Status: active"; then ufw allow "$PORT/tcp" >/dev/null; fi
if command -v firewall-cmd >/dev/null && firewall-cmd --state >/dev/null 2>&1; then
  firewall-cmd --permanent --add-port="$PORT/tcp" >/dev/null && firewall-cmd --reload >/dev/null
fi

sleep 2
systemctl is-active --quiet eixo || { echo "O serviço não subiu. Veja: journalctl -u eixo -n 30"; exit 1; }
IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
echo
echo "Eixo instalado e no ar."
echo "  Endereço:        http://${IP:-IP-DO-SERVIDOR}:$PORT/"
echo "  Chave de acesso: $(cat /var/lib/eixo/chave.txt)"
echo "  Dados guardados: /var/lib/eixo/eixo-dados.json"

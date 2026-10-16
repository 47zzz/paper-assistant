#!/bin/bash
# 論文書房 啟動器
#   ./start.sh            → 桌面視窗（PyGObject + WebKitGTK；失敗時退回 Chrome app 視窗 / 瀏覽器）
#   ./start.sh --server   → 只跑本機伺服器（前景；Ctrl+C 結束）
#   ./start.sh --browser  → 跑伺服器並用預設瀏覽器開啟
#   ./start.sh --install  → 安裝桌面捷徑、圖示與 systemd --user 常駐服務（提醒通知靠這個）
cd "$(dirname "$0")" || exit 1
case "${1:-}" in
  --server)  exec python3 app/server.py "${@:2}" ;;
  --browser) exec python3 app/server.py --open "${@:2}" ;;
  --install) exec bash app/install.sh "${@:2}" ;;
  *)         exec python3 app/desktop.py "$@" ;;
esac

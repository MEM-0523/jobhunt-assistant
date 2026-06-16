#!/bin/bash
# 转型导航 CareerShift - 启动脚本
# 用途：启动后端 + 公网隧道，然后分享 https://dada-jobhunt.pages.dev 给其他人

echo "=============================================="
echo "  转型导航 CareerShift - 启动脚本"
echo "=============================================="

# 1. 启动后端
echo ""
echo "[1/2] 启动后端服务..."
cd "$(dirname "$0")/backend"
python3 -m uvicorn main:app --reload --port 8001 --host 0.0.0.0 &
BACKEND_PID=$!
echo "后端 PID: $BACKEND_PID"
sleep 2

# 2. 启动公网隧道
echo ""
echo "[2/2] 启动公网隧道..."
echo "隧道地址: https://careershift.loca.lt"
npx --yes localtunnel --port 8001 --subdomain careershift --print-requests &
TUNNEL_PID=$!
echo "隧道 PID: $TUNNEL_PID"

echo ""
echo "=============================================="
echo "  启动完成！"
echo "  公网访问地址: https://dada-jobhunt.pages.dev"
echo "  后端隧道地址: https://careershift.loca.lt"
echo "=============================================="
echo ""
echo "按 Ctrl+C 停止所有服务"

trap "kill $BACKEND_PID $TUNNEL_PID 2>/dev/null; echo '已停止所有服务'" EXIT
wait
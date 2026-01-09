@echo off
cd /d C:\Users\smcma\OneDrive\Desktop\seasonal10302025\my-stock-app\

call python populate_calendar.py
call python download_stock_data.py
call python update_all_indicators.py

git add .
git commit -m "Daily update - %date%"
git push origin main
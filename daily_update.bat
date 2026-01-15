@echo off
:: 1. Navigate to the NEW directory
cd /d C:\Users\Steve\finbacktester\backtester

:: 2. Run your Python scripts
echo Running Calendar Update...
python populate_calendar.py

echo Downloading Stock Data...
python download_stock_data.py

echo Updating Indicators...
python update_all_indicators.py

:: 3. Push to GitHub
echo Pushing to GitHub...
git add .
git commit -m "Daily update - %date% %time%"
git push origin main

echo Done!
timeout /t 10
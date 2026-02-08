import { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    // Homepage
    { url: "https://finbacktester.com", lastModified: new Date() },
    
    // Market Overview
    { url: "https://finbacktester.com/market-snapshot", lastModified: new Date() },
    
    // Signal Trackers (NEW)
    { url: "https://finbacktester.com/signal-trackers", lastModified: new Date() },
    { url: "https://finbacktester.com/rsi-tracker", lastModified: new Date() },
    { url: "https://finbacktester.com/streak-tracker", lastModified: new Date() },
    { url: "https://finbacktester.com/seasonal-tracker", lastModified: new Date() },
    
    // Single Stock Backtesting
    { url: "https://finbacktester.com/trend-strategies", lastModified: new Date() },
    { url: "https://finbacktester.com/connors-strategies", lastModified: new Date() },
    
    // Portfolio Backtesting
    { url: "https://finbacktester.com/portfolio-momentum", lastModified: new Date() },
    
    // Seasonality
    { url: "https://finbacktester.com/seasonal-single", lastModified: new Date() },
    { url: "https://finbacktester.com/seasonal-dashboard", lastModified: new Date() },
    
    // Streaks
    { url: "https://finbacktester.com/streaks-single", lastModified: new Date() },
    { url: "https://finbacktester.com/streaks-scanner", lastModified: new Date() },
    
    // RSI Analysis
    { url: "https://finbacktester.com/rsi-single", lastModified: new Date() },
    { url: "https://finbacktester.com/rsi-dashboard", lastModified: new Date() },
    
    // Info Pages
    { url: "https://finbacktester.com/about", lastModified: new Date() },
    { url: "https://finbacktester.com/disclaimer", lastModified: new Date() },
    { url: "https://finbacktester.com/privacy-policy", lastModified: new Date() },
  ];
}
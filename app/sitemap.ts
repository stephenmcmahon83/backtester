import { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: "https://finbacktester.com", lastModified: new Date() },
    { url: "https://finbacktester.com/valuation", lastModified: new Date() },
    { url: "https://finbacktester.com/market-scanner", lastModified: new Date() },
    { url: "https://finbacktester.com/seasonal-dashboard", lastModified: new Date() },
    { url: "https://finbacktester.com/trend-strategies", lastModified: new Date() },
    {url: "https://finbacktester.com/about", lastModified: new Date() },
    { url: "https://finbacktester.com/disclaimer", lastModified: new Date() },
  ];
}
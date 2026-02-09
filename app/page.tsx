import Link from 'next/link';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'FinBacktester | Quantitative Stock Market Tools',
  description: 'Tools for backtesting, calculating intrinsic value, economic indicators, technical trends, and seasonal patterns.',
};

type ToolItem = {
  title: string;
  href: string;
  description: string;
  color: string;
  badge?: string;
};

type ToolCategory = {
  category: string;
  description?: string;
  items: ToolItem[];
};

export default function HomePage() {
  const tools: ToolCategory[] = [
    {
      category: 'Daily Insights',
      items: [
        {
          title: 'Market Snapshot',
          href: '/market-snapshot',
          description: 'A daily multi-factor overview of 120 stocks.',
          color: 'bg-indigo-50 border-indigo-200 hover:border-indigo-400',
          badge: 'Daily Updated',
        },
        {
          title: 'Signal Trackers',
          href: '/signal-trackers',
          description: 'Monitor the real-world performance of our daily picks. Review win rates and returns for RSI, Streak, and Seasonal strategies.',
          color: 'bg-emerald-50 border-emerald-200 hover:border-emerald-400',
          badge: 'Performance',
        },
      ],
    },
    {
      category: 'Fundamental Analysis',
      items: [
        {
          title: 'Intrinsic Value Calculator',
          href: '/valuation',
          description: 'Estimate fair value using a 15x earnings model. Explore 15 years of annual financial data for individual stocks.',
          color: 'bg-blue-50 border-blue-200 hover:border-blue-400',
        },
        {
          title: 'Economic Calendar Backtester',
          href: '/economic-indicators',
          description: 'Analyze how SPY, QQQ, Gold, and Bonds historically react to major economic releases such as CPI, Payrolls, and GDP.',
          color: 'bg-slate-50 border-slate-200 hover:border-slate-400',
          badge: 'Macro',
        },
      ],
    },
    {
      category: 'Technical Strategies',
      items: [
        {
          title: 'Trend Strategies',
          href: '/trend-strategies',
          description: 'Backtest classic trend-following strategies on 120 individual stocks to identify long-term opportunities.',
          color: 'bg-cyan-50 border-cyan-200 hover:border-cyan-400',
        },
        {
          title: 'Mean Reversion',
          href: '/connors-strategies',
          description: 'Test mean-reversion strategies on 120 stocks designed to capitalize on short-term pullbacks.',
          color: 'bg-violet-50 border-violet-200 hover:border-violet-400',
        },
      ],
    },
    {
      category: 'Market Scanners',
      description: 'Over of 120 stocks to find stocks matching specific criteria',
      items: [
        {
          title: 'RSI Scanner',
          href: '/rsi-dashboard',
          description: 'Scan for oversold and overbought stocks, with historical forward return analysis.',
          color: 'bg-orange-50 border-orange-200 hover:border-orange-400',
        },
        {
          title: 'Streak Scanner',
          href: '/streaks-scanner',
          description: 'Find stocks on consecutive winning or losing streaks across the market and review their historical performance.',
          color: 'bg-red-50 border-red-200 hover:border-red-400',
        },
        {
          title: 'Seasonality Scanner',
          href: '/seasonal-dashboard',
          description: 'Discover which stocks historically perform best—or worst—based on seasonal patterns derived from 20+ years of data.',
          color: 'bg-pink-50 border-pink-200 hover:border-pink-400',
        },
      ],
    },
    {
      category: 'Single Stock Analysis',
      description: 'Deep-dive backtesting tools for individual tickers',
      items: [
        {
          title: 'Streak Backtester',
          href: '/streaks-single',
          description: 'Analyze what happens after a specific stock drops or rises for consecutive days.',
          color: 'bg-red-50 border-red-200 hover:border-red-400',
        },
        {
          title: 'RSI Backtester',
          href: '/rsi-single',
          description: 'Backtest how a specific stock performs at various RSI(2) levels. See historical returns when oversold or overbought.',
          color: 'bg-orange-50 border-orange-200 hover:border-orange-400',
        },
        {
          title: 'Seasonality Backtester',
          href: '/seasonal-single',
          description: 'View 20+ years of daily seasonal patterns for any stock. Find the historically best and worst times of year to trade.',
          color: 'bg-pink-50 border-pink-200 hover:border-pink-400',
        },
      ],
    },
  ];

  return (
    <div className="bg-gradient-to-b from-white to-gray-50 min-h-screen">
      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16 text-center">
        <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 tracking-tight mb-6">
          Quantitative Stock Market <span className="text-indigo-600">Backtesting Tools</span>
        </h1>

        {/* Performance Note Alert */}
        <div className="max-w-3xl mx-auto bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r shadow-sm text-left flex items-start gap-3">
          <div className="text-amber-500 mt-1">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="font-bold text-amber-800">Performance Note</p>
            <p className="text-sm text-amber-700">
              Some tools (specifically the <strong>Intrinsic Value Calculator</strong>) run on serverless infrastructure.
              Please allow <strong>30–60 seconds</strong> for the backend to initialize on your first search if it hasn&apos;t been used recently.
              Subsequent searches will be instant.
            </p>
          </div>
        </div>

        {/* Primary CTA */}
        <div className="mt-10">
          <Link
            href="/market-snapshot"
            className="inline-flex items-center gap-2 bg-indigo-600 text-white px-8 py-4 rounded-lg font-bold text-lg hover:bg-indigo-700 transition-colors shadow-lg hover:shadow-xl"
          >
            View Today&apos;s Market Snapshot
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </section>

      {/* Tools Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        {tools.map((category) => (
          <div key={category.category} className="mb-12">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                {category.category}
                <span className="h-px flex-1 bg-gray-200 ml-4"></span>
              </h2>
              {category.description && (
                <p className="text-sm text-gray-500 mt-1">{category.description}</p>
              )}
            </div>

            <div className={`grid grid-cols-1 gap-6 ${
              category.items.length === 3 
                ? 'md:grid-cols-3' 
                : 'md:grid-cols-2'
            }`}>
              {category.items.map((tool) => (
                <Link
                  key={tool.href}
                  href={tool.href}
                  className={`block p-6 rounded-xl border-2 transition-all duration-200 hover:shadow-md hover:-translate-y-1 ${tool.color}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xl font-bold text-gray-900">{tool.title}</h3>
                    {tool.badge && (
                      <span className="px-2 py-1 text-xs font-bold bg-gray-900 text-white rounded-full uppercase tracking-wide">
                        {tool.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed">{tool.description}</p>
                  <div className="mt-4 text-indigo-600 font-semibold text-sm flex items-center gap-1 group">
                    Open Tool
                    <svg className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </section>

      {/* Footer Info */}
      <section className="bg-white border-t border-gray-200 py-12">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h3 className="text-lg font-bold text-gray-900 mb-2">About FinBacktester</h3>
          <p className="text-gray-500 mb-6">
            Providing quantitative tools and data insights to retail investors.
          </p>
          <div className="flex justify-center gap-4 text-sm font-medium text-indigo-600">
            <Link href="/about" className="hover:underline">About Us</Link>
            <span className="text-gray-300">•</span>
            <Link href="/disclaimer" className="hover:underline">Disclaimer</Link>
            <span className="text-gray-300">•</span>
            <Link href="/privacy-policy" className="hover:underline">Privacy Policy</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
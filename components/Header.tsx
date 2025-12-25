import Link from 'next/link';

export default function Header() {
  return (
    <header className="bg-white shadow-md border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <nav className="flex flex-col md:flex-row items-center justify-between gap-4">
          
          {/* Brand Logo / Name */}
          <div className="flex items-center">
            <Link href="/" className="group flex items-center gap-2">
              <div className="bg-indigo-600 text-white font-bold text-xl p-1.5 rounded-lg group-hover:bg-indigo-700 transition-colors">
                M
              </div>
              <span className="text-xl font-extrabold tracking-tight text-gray-900 group-hover:text-indigo-600 transition-colors">
                Model<span className="text-indigo-600">Playground</span>
              </span>
            </Link>
          </div>

          {/* --- REVISED NAVIGATION LINKS --- */}
          <div className="flex flex-wrap justify-center items-center gap-1 md:gap-2">
            
            {/* Individual Backtester Links */}
            <Link 
              href="/trend-strategies" 
              className="text-gray-700 hover:text-indigo-600 hover:bg-indigo-50 px-3 py-2 rounded-md text-sm font-semibold transition-colors"
            >
              Trend (Single Stock)
            </Link>

            <Link 
              href="/connors-strategies" 
              className="text-gray-700 hover:text-indigo-600 hover:bg-indigo-50 px-3 py-2 rounded-md text-sm font-semibold transition-colors"
            >
              Mean Reversion
            </Link>
            
             {/* Seasonality Dropdown */}
            <div className="relative group">
               <button className="text-gray-700 hover:text-indigo-600 hover:bg-indigo-50 px-3 py-2 rounded-md text-sm font-semibold transition-colors flex items-center gap-1">
                  Seasonality <span className="text-xs">▼</span>
               </button>
               
               <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 w-56 bg-white border border-gray-200 rounded-md shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                  <Link 
                    href="/seasonal-single" 
                    className="block px-4 py-3 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 border-b border-gray-100"
                  >
                    Single Stock Seasonality
                  </Link>
                  <Link 
                    href="/seasonal-dashboard" 
                    className="block px-4 py-3 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-600"
                  >
                    All Stocks Seasonality
                  </Link>
               </div>
            </div>

            {/* Streaks Dropdown (NEW) */}
            <div className="relative group">
               <button className="text-gray-700 hover:text-indigo-600 hover:bg-indigo-50 px-3 py-2 rounded-md text-sm font-semibold transition-colors flex items-center gap-1">
                  Streaks <span className="text-xs">▼</span>
               </button>
               
               <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 w-56 bg-white border border-gray-200 rounded-md shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                  <Link 
                    href="/streaks-single" 
                    className="block px-4 py-3 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 border-b border-gray-100"
                  >
                    Single Stock Analyzer
                  </Link>
                  <Link 
                    href="/streaks-scanner" 
                    className="block px-4 py-3 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-600"
                  >
                    All Stocks Scanner
                  </Link>
               </div>
            </div>

            {/* Divider */}
            <div className="hidden md:block w-px h-6 bg-gray-300 mx-2"></div>

            {/* Informational Links */}
            <div className="flex gap-1">
                <Link 
                    href="/about" 
                    className="text-gray-500 hover:text-indigo-600 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                >
                    About
                </Link>
                <Link 
                    href="/disclaimer" 
                    className="text-gray-500 hover:text-indigo-600 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                >
                    Disclaimer
                </Link>
            </div>

          </div>
        </nav>
      </div>
    </header>
  );
}
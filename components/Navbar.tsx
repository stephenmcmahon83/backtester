"use client";

import { useState } from "react";
import Link from "next/link";

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  // Toggle for the main mobile menu
  const toggleMenu = () => setIsOpen(!isOpen);

  // Toggle for specific dropdowns on mobile
  const toggleDropdown = (name: string) => {
    if (activeDropdown === name) {
      setActiveDropdown(null);
    } else {
      setActiveDropdown(name);
    }
  };

  return (
    <nav className="bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex items-center justify-between">
          
          {/* LOGO SECTION */}
          <div className="flex items-center">
            <Link href="/" className="group flex items-center gap-2">
              <div className="text-indigo-600">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <span className="text-xl font-extrabold tracking-tight text-gray-900 group-hover:text-indigo-600 transition-colors">
                Fin<span className="text-indigo-600">Backtester</span>
              </span>
            </Link>
          </div>

          {/* DESKTOP MENU (Hidden on Mobile) */}
          <div className="hidden md:flex items-center gap-2">
            <Link href="/" className="text-gray-700 hover:text-indigo-600 hover:bg-indigo-50 px-3 py-2 rounded-md text-sm font-semibold transition-colors">Home</Link>
            <div className="w-px h-6 bg-gray-300 mx-1"></div>
            
            {/* Desktop Dropdown 1: Single Stock */}
            <div className="relative group z-50">
              <button className="text-gray-700 hover:text-indigo-600 hover:bg-indigo-50 px-3 py-2 rounded-md text-sm font-semibold transition-colors flex items-center gap-1">
                Single Stock <span className="text-xs">▼</span>
              </button>
              <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 w-56 bg-white border border-gray-200 rounded-md shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                <Link href="/trend-strategies" className="block px-4 py-3 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 border-b border-gray-100">Trend Strategies</Link>
                <Link href="/connors-strategies" className="block px-4 py-3 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-600">Mean-Reversion</Link>
              </div>
            </div>

            {/* Desktop Dropdown 2: Portfolio */}
            <div className="relative group z-50">
              <button className="text-gray-700 hover:text-indigo-600 hover:bg-indigo-50 px-3 py-2 rounded-md text-sm font-semibold transition-colors flex items-center gap-1">
                Portfolio <span className="text-xs">▼</span>
              </button>
              <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 w-64 bg-white border border-gray-200 rounded-md shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                <Link href="/portfolio-momentum" className="block px-4 py-3 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-600">Monthly Momentum</Link>
              </div>
            </div>

            {/* Desktop Dropdown 3: Seasonality */}
            <div className="relative group z-50">
              <button className="text-gray-700 hover:text-indigo-600 hover:bg-indigo-50 px-3 py-2 rounded-md text-sm font-semibold transition-colors flex items-center gap-1">
                Seasonality <span className="text-xs">▼</span>
              </button>
              <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 w-64 bg-white border border-gray-200 rounded-md shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                <Link href="/seasonal-single" className="block px-4 py-3 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 border-b border-gray-100">Single Stock - Full Year</Link>
                <Link href="/seasonal-dashboard" className="block px-4 py-3 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-600">All Stocks - Current</Link>
              </div>
            </div>

            {/* Desktop Dropdown 4: Streaks (NEW) */}
            <div className="relative group z-50">
              <button className="text-gray-700 hover:text-indigo-600 hover:bg-indigo-50 px-3 py-2 rounded-md text-sm font-semibold transition-colors flex items-center gap-1">
                Streaks <span className="text-xs">▼</span>
              </button>
              <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 w-64 bg-white border border-gray-200 rounded-md shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                <Link href="/streaks-single" className="block px-4 py-3 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 border-b border-gray-100">Single Stock - All Streaks</Link>
                <Link href="/streaks-scanner" className="block px-4 py-3 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-600">All Stocks - Current Streaks</Link>
              </div>
            </div>

            <div className="w-px h-6 bg-gray-300 mx-2"></div>
            
            <div className="flex gap-1">
              <Link href="/about" className="text-gray-500 hover:text-indigo-600 px-3 py-2 rounded-md text-sm font-medium transition-colors">About</Link>
              <Link href="/disclaimer" className="text-gray-500 hover:text-indigo-600 px-3 py-2 rounded-md text-sm font-medium transition-colors">Disclaimer</Link>
            </div>

            {/* ✅ DONATE BUTTON (Desktop) */}
            <a 
              href="https://www.buymeacoffee.com/finbacktester.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="ml-2 bg-[#40DCA5] hover:bg-[#35b88a] text-white px-4 py-2 rounded-full text-sm font-bold shadow-sm transition-all transform hover:scale-105 flex items-center gap-1"
            >
              Donate
            </a>
          </div>

          {/* MOBILE MENU BUTTON (Hamburger) */}
          <div className="md:hidden flex items-center">
            <button onClick={toggleMenu} className="text-gray-700 hover:text-indigo-600 focus:outline-none p-2">
              {isOpen ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* MOBILE MENU DROPDOWN (Visible when Open) */}
      {isOpen && (
        <div className="md:hidden bg-white border-t border-gray-100 shadow-lg pb-4 px-4">
          <div className="flex flex-col space-y-2 pt-2">
            <Link href="/" className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-indigo-600 hover:bg-indigo-50" onClick={toggleMenu}>
              Home
            </Link>

            {/* Mobile Dropdown 1 */}
            <div>
              <button 
                onClick={() => toggleDropdown('single')} 
                className="w-full flex justify-between items-center px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-indigo-600 hover:bg-indigo-50"
              >
                Single Stock
                <span className={`text-xs transform transition-transform ${activeDropdown === 'single' ? 'rotate-180' : ''}`}>▼</span>
              </button>
              {activeDropdown === 'single' && (
                <div className="pl-6 space-y-1 bg-gray-50 rounded-md mt-1">
                  <Link href="/trend-strategies" className="block px-3 py-2 text-sm text-gray-600 hover:text-indigo-600" onClick={toggleMenu}>Trend Strategies</Link>
                  <Link href="/connors-strategies" className="block px-3 py-2 text-sm text-gray-600 hover:text-indigo-600" onClick={toggleMenu}>Mean-Reversion</Link>
                </div>
              )}
            </div>

            {/* Mobile Dropdown 2 */}
            <div>
              <button 
                onClick={() => toggleDropdown('portfolio')} 
                className="w-full flex justify-between items-center px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-indigo-600 hover:bg-indigo-50"
              >
                Portfolio
                <span className={`text-xs transform transition-transform ${activeDropdown === 'portfolio' ? 'rotate-180' : ''}`}>▼</span>
              </button>
              {activeDropdown === 'portfolio' && (
                <div className="pl-6 space-y-1 bg-gray-50 rounded-md mt-1">
                  <Link href="/portfolio-momentum" className="block px-3 py-2 text-sm text-gray-600 hover:text-indigo-600" onClick={toggleMenu}>Monthly Momentum</Link>
                </div>
              )}
            </div>

             {/* Mobile Dropdown 3 */}
             <div>
              <button 
                onClick={() => toggleDropdown('seasonal')} 
                className="w-full flex justify-between items-center px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-indigo-600 hover:bg-indigo-50"
              >
                Seasonality
                <span className={`text-xs transform transition-transform ${activeDropdown === 'seasonal' ? 'rotate-180' : ''}`}>▼</span>
              </button>
              {activeDropdown === 'seasonal' && (
                <div className="pl-6 space-y-1 bg-gray-50 rounded-md mt-1">
                  <Link href="/seasonal-single" className="block px-3 py-2 text-sm text-gray-600 hover:text-indigo-600" onClick={toggleMenu}>Single Stock - Full Year</Link>
                  <Link href="/seasonal-dashboard" className="block px-3 py-2 text-sm text-gray-600 hover:text-indigo-600" onClick={toggleMenu}>All Stocks - Current</Link>
                </div>
              )}
            </div>

             {/* Mobile Dropdown 4: Streaks (NEW) */}
             <div>
              <button 
                onClick={() => toggleDropdown('streaks')} 
                className="w-full flex justify-between items-center px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-indigo-600 hover:bg-indigo-50"
              >
                Streaks
                <span className={`text-xs transform transition-transform ${activeDropdown === 'streaks' ? 'rotate-180' : ''}`}>▼</span>
              </button>
              {activeDropdown === 'streaks' && (
                <div className="pl-6 space-y-1 bg-gray-50 rounded-md mt-1">
                  <Link href="/streaks-single" className="block px-3 py-2 text-sm text-gray-600 hover:text-indigo-600" onClick={toggleMenu}>Single Stock Analyzer</Link>
                  <Link href="/streaks-scanner" className="block px-3 py-2 text-sm text-gray-600 hover:text-indigo-600" onClick={toggleMenu}>All Stocks Scanner</Link>
                </div>
              )}
            </div>

            <div className="border-t border-gray-200 my-2"></div>
            
            {/* ✅ DONATE BUTTON (Mobile) */}
             <a 
              href="https://www.buymeacoffee.com/finbacktester.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="block text-center bg-[#40DCA5] text-white px-3 py-2 rounded-md text-base font-bold shadow-sm mb-2"
              onClick={toggleMenu}
            >
              Donate
            </a>

            <Link href="/about" className="block px-3 py-2 rounded-md text-base font-medium text-gray-500 hover:text-indigo-600" onClick={toggleMenu}>About</Link>
            <Link href="/disclaimer" className="block px-3 py-2 rounded-md text-base font-medium text-gray-500 hover:text-indigo-600" onClick={toggleMenu}>Disclaimer</Link>
          </div>
        </div>
      )}
    </nav>
  );
}
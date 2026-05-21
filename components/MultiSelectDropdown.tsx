import React, { useState, useRef, useEffect } from 'react';

interface MultiSelectProps {
  options: string[];
  selected: string[];
  onToggle: (option: string) => void;
  maxSelection?: number;
}

export const MultiSelectDropdown = ({ options, selected, onToggle, maxSelection = 5 }: MultiSelectProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <button 
        type="button"
        onClick={() => setIsOpen(!isOpen)} 
        className="w-full px-4 py-2 border border-gray-300 rounded-md bg-white text-left text-sm font-medium truncate text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
      >
        {selected.length > 0 ? selected.join(', ') : `Select Assets (Max ${maxSelection})...`}
      </button>
      
      {isOpen && (
        <div className="absolute left-0 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-xl max-h-60 overflow-y-auto z-50">
          <input 
            type="text"
            className="w-full p-2 border-b sticky top-0 bg-white outline-none text-sm text-slate-800"
            placeholder="Filter symbols..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)} 
          />
          <div className="p-1">
            {options.filter(o => o.toLowerCase().includes(searchTerm.toLowerCase())).map(opt => {
              const isChecked = selected.includes(opt);
              return (
                <div 
                  key={opt} 
                  className={`px-4 py-2 text-sm font-semibold rounded cursor-pointer transition-colors flex items-center justify-between ${isChecked ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700 hover:bg-slate-50'}`}
                  onClick={() => onToggle(opt)}
                >
                  <span>{opt}</span>
                  {isChecked && <span className="text-indigo-600 text-xs">✓ Added</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
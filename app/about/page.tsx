import React from 'react';

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <div className="bg-gray-50 border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-6 py-16 text-center">
          <h1 className="text-4xl font-extrabold text-gray-900 mb-4">
            About FinBacktester
          </h1>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-3xl mx-auto px-6 py-12 space-y-12">
        
        {/* The Personal Note */}
        <section className="prose prose-lg text-gray-700 leading-relaxed">
          <p>
            Hi, I'm Steve.I’ve been involved in the financial markets for about 20 years now as an individual investor, and 10 years as a systems trader. 
          </p>
          <p>
            I built FinBacktester because I wanted to create the kind of tool I wish I had when I started: 
            something that helps individual system traders and investors move towards data-driven decision-making. 
          </p>
          <p> 
            These tools are not a guaranteed way to make money in the markets. But they do provide a solid foundation for testing and refining trading strategies based on historical data, patterns, and observations. My hope is that they help you in some way become a more informed and successful market participant.
          </p>
        </section>

        {/* Divider */}
        <hr className="border-gray-200" />

        {/* The "Support the Project" Section */}
        <section className="bg-blue-50 rounded-2xl p-8 border border-blue-100">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
            <div className="flex-1">
              <h3 className="text-xl font-bold text-gray-900 mb-2">Supporting the Site</h3>
              <p className="text-gray-700 text-sm mb-4">
                It takes time and effort to build a platform like this and keep it running smoothly. 
                There are costs for server hosting, data feeds, etc.
              </p>
              <p className="text-gray-700 text-sm">
                If you've found value in these tools and want to support the project, any donation is greatly appreciated—it helps 
                keep the lights on and the data flowing. Please do not feel any pressure to do so though.
              </p>
            </div>
            <div className="flex-shrink-0">
               <a 
                href="https://www.buymeacoffee.com/finbacktester.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-[#40DCA5] hover:bg-[#35b88a] shadow-sm transition-transform transform hover:scale-105"
              >
                <span>Donate</span>
              </a>
            </div>
          </div>
        </section>

        {/* Contact Section */}
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Get in Touch</h2>
          <p className="text-gray-700 mb-6">
            I am always looking to improve this platform. If you have suggestions for new features, 
            found a bug, or just want to discuss trading strategies, feel free to reach out.
          </p>
          
          <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200 w-fit">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <a href="mailto:steve@finbacktester.com" className="text-indigo-600 font-medium hover:underline text-lg">
              steve@finbacktester.com
            </a>
          </div>
        </section>

      </div>
    </div>
  );
}
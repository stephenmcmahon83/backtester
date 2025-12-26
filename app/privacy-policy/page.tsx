import React from 'react';

export default function PrivacyPolicy() {
  const currentDate = new Date().toLocaleDateString();

  return (
    <div className="p-8 max-w-4xl mx-auto min-h-screen bg-white">
      <header className="mb-8 border-b border-gray-200 pb-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
        <p className="text-gray-500 text-sm">Last Updated: {currentDate}</p>
      </header>

      <div className="prose prose-blue max-w-none text-gray-700 space-y-6">
        <p>
          At <strong>FinBacktester</strong>, accessible from our website, one of our main priorities is the privacy of our visitors. This Privacy Policy document contains types of information that is collected and recorded by FinBacktester and how we use it.
        </p>
        <p>
          If you have additional questions or require more information about our Privacy Policy, do not hesitate to contact us.
        </p>

        <h2 className="text-xl font-bold text-gray-900 mt-6">Log Files</h2>
        <p>
          FinBacktester follows a standard procedure of using log files. These files log visitors when they visit websites. All hosting companies do this and a part of hosting services' analytics. The information collected by log files includes internet protocol (IP) addresses, browser type, Internet Service Provider (ISP), date and time stamp, referring/exit pages, and possibly the number of clicks. These are not linked to any information that is personally identifiable. The purpose of the information is for analyzing trends, administering the site, tracking users' movement on the website, and gathering demographic information.
        </p>

        <h2 className="text-xl font-bold text-gray-900 mt-6">Cookies and Web Beacons</h2>
        <p>
          Like any other website, FinBacktester uses 'cookies'. These cookies are used to store information including visitors' preferences, and the pages on the website that the visitor accessed or visited. The information is used to optimize the users' experience by customizing our web page content based on visitors' browser type and/or other information.
        </p>

        <h2 className="text-xl font-bold text-gray-900 mt-6">Google DoubleClick DART Cookie</h2>
        <p>
          Google is one of a third-party vendor on our site. It also uses cookies, known as DART cookies, to serve ads to our site visitors based upon their visit to our site and other sites on the internet. However, visitors may choose to decline the use of DART cookies by visiting the Google ad and content network Privacy Policy at the following URL – <a href="https://policies.google.com/technologies/ads" className="text-blue-600 underline" target="_blank" rel="noopener noreferrer">https://policies.google.com/technologies/ads</a>
        </p>

        <h2 className="text-xl font-bold text-gray-900 mt-6">Google Analytics</h2>
        <p>
          We use Google Analytics to analyze the use of our website. Google Analytics gathers information about website use by means of cookies. The information gathered relating to our website is used to create reports about the use of our website. Google's privacy policy is available at: <a href="https://policies.google.com/privacy" className="text-blue-600 underline" target="_blank" rel="noopener noreferrer">https://policies.google.com/privacy</a>.
        </p>

        <h2 className="text-xl font-bold text-gray-900 mt-6">Privacy Policies of Third Party Partners</h2>
        <p>
          You may consult this list to find the Privacy Policy for each of the advertising partners of FinBacktester.
        </p>
        <p>
          Third-party ad servers or ad networks uses technologies like cookies, JavaScript, or Web Beacons that are used in their respective advertisements and links that appear on FinBacktester, which are sent directly to users' browser. They automatically receive your IP address when this occurs. These technologies are used to measure the effectiveness of their advertising campaigns and/or to personalize the advertising content that you see on websites that you visit.
        </p>
        <p>
          Note that FinBacktester has no access to or control over these cookies that are used by third-party advertisers.
        </p>

        <h2 className="text-xl font-bold text-gray-900 mt-6">CCPA Privacy Rights (Do Not Sell My Personal Information)</h2>
        <p>Under the CCPA, among other rights, California consumers have the right to:</p>
        <ul className="list-disc pl-5 space-y-2">
          <li>Request that a business that collects a consumer's personal data disclose the categories and specific pieces of personal data that a business has collected about consumers.</li>
          <li>Request that a business delete any personal data about the consumer that a business has collected.</li>
          <li>Request that a business that sells a consumer's personal data, not sell the consumer's personal data.</li>
        </ul>
        <p className="mt-2">If you make a request, we have one month to respond to you. If you would like to exercise any of these rights, please contact us.</p>

        <h2 className="text-xl font-bold text-gray-900 mt-6">GDPR Data Protection Rights</h2>
        <p>We would like to make sure you are fully aware of all of your data protection rights. Every user is entitled to the following:</p>
        <ul className="list-disc pl-5 space-y-2">
          <li>The right to access – You have the right to request copies of your personal data.</li>
          <li>The right to rectification – You have the right to request that we correct any information you believe is inaccurate.</li>
          <li>The right to erasure – You have the right to request that we erase your personal data, under certain conditions.</li>
        </ul>

        <h2 className="text-xl font-bold text-gray-900 mt-6">Contact Information</h2>
        <p>
          If you have any questions about this Privacy Policy, please contact us via email at: <strong>[steve@finbacktester.com]</strong>.
        </p>
      </div>
    </div>
  );
}
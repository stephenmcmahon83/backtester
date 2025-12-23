export default function DisclaimerPage() {
  return (
    <div className="bg-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="prose prose-indigo max-w-none">
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight sm:text-4xl">
            Disclaimer
          </h1>

          <p className="text-lg text-gray-600 leading-8 mt-4">
            Welcome to FinBacktester. Before using the tools and information provided on this website,
            please carefully read the following disclaimer. Your use of this site signifies your
            acceptance of these terms.
          </p>

          <h2 className="mt-10 text-2xl font-bold text-gray-900">
            For Educational and Informational Use Only
          </h2>
          <p>
            All content, tools, backtesting results, and data presented on FinBacktester are for
            educational and informational purposes only. They are not intended to be, and should not
            be construed as, financial, investment, legal, or tax advice. The strategies and models
            demonstrated are based on historical data and are not indicative of future results.
          </p>

          <h2 className="mt-10 text-2xl font-bold text-gray-900">
            No Recommendation to Buy or Sell
          </h2>
          <p>
            FinBacktester is not a registered investment advisor, broker, or dealer. The information
            provided does not constitute a recommendation, solicitation, or offer to buy or sell
            any security, financial product, or instrument. You should not make any investment
            decision based solely on the information found on this website.
          </p>

          <h2 className="mt-10 text-2xl font-bold text-gray-900">
            Accuracy of Information
          </h2>
          <p>
            While we strive to provide accurate and timely information, FinBacktester and its owners
            make no representation or warranty, express or implied, as to the accuracy, completeness,
            or reliability of the data and calculations provided. Data may be delayed, inaccurate, or
            incomplete. We are not responsible for any errors or omissions, or for the results
            obtained from the use of this information.
          </p>

          <h2 className="mt-10 text-2xl font-bold text-gray-900">
            Inherent Risks of Trading
          </h2>
          <p>
            Trading and investing in securities involve a substantial risk of loss and are not suitable
            for every investor. The value of stocks can and does fluctuate, and you may lose your entire
            investment. Past performance is not a guarantee of future performance. You are solely
            responsible for your own investment decisions and any resulting financial losses.
          </p>

          <p>
            We strongly advise you to consult with a qualified financial professional before making
            any investment decisions. By using FinBacktester, you agree to hold its owners, affiliates,
            and contributors harmless from any and all losses, damages, or liabilities that may arise
            from your use of the information and tools provided.
          </p>
        </div>
      </div>
    </div>
  );
}
# FILE: download_stock_data.py

import time  # Added for throttling and sleep
import yfinance as yf
import pandas as pd
from supabase import create_client, Client

# --- CONFIGURE YOUR DETAILS HERE ---
SUPABASE_URL = "https://pbjmajhocspvtobjcksf.supabase.co"
SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBiam1hamhvY3NwdnRvYmpja3NmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Mzc5NDAzOCwiZXhwIjoyMDY5MzcwMDM4fQ.t6mbbFNeuO87IS9dn-UXZ5xBCy-SmGMnpkay7cA7CNI"
# -----------------------------------

def get_tickers_from_supabase(supabase: Client) -> list:
    """Fetches the list of symbols to process from the 'symbols' table."""
    try:
        print("Fetching tickers from the 'symbols' table in Supabase...")
        response = supabase.table('symbols').select('symbol').execute()
        if response.data:
            tickers = [item['symbol'] for item in response.data]
            print(f"Found {len(tickers)} tickers to process: {tickers}")
            return tickers
        else:
            print("No tickers found in the 'symbols' table.")
            return []
    except Exception as e:
        print(f"Error fetching tickers from Supabase: {e}")
        return []

def download_and_prepare_data(tickers: list) -> list:
    """Downloads historical data for tickers and prepares it for upload."""
    all_data_to_upload = []
    
    for ticker in tickers:
        try:
            print(f"\n--- Downloading data for {ticker} ---")
            stock_df = yf.download(ticker, period="max", progress=True, auto_adjust=True)

            if stock_df.empty:
                print(f"No data found for {ticker}. Skipping.")
                continue
            
            stock_df.reset_index(inplace=True)
            stock_df.rename(columns={'Date': 'date'}, inplace=True)
            
            # --- THE DEFINITIVE FIX ---
            # We extract the underlying NumPy array (.values) and flatten it
            # to guarantee it's 1-dimensional.
            final_df = pd.DataFrame({
                'date': stock_df['date'], # Date column is usually fine
                'symbol': ticker,
                'open': stock_df['Open'].values.flatten(),
                'high': stock_df['High'].values.flatten(),
                'low': stock_df['Low'].values.flatten(),
                'close': stock_df['Close'].values.flatten(),
                'volume': stock_df['Volume'].values.flatten()
            })
            # --- END OF FIX ---
            
            final_df['date'] = pd.to_datetime(final_df['date'])
            final_df['year'] = final_df['date'].dt.year
            final_df['trading_day_of_year'] = final_df.groupby('year').cumcount() + 1
            final_df.drop(columns=['year'], inplace=True)

            records = final_df.to_dict(orient='records')
            for record in records:
                record['date'] = record['date'].strftime('%Y-%m-%d')

            all_data_to_upload.extend(records)
            print(f"Successfully prepared {len(records)} rows for {ticker}.")

        except Exception as e:
            print(f"An unexpected error occurred while processing {ticker}: {e}")
            
    return all_data_to_upload

def main():
    """Main function to run the data ingestion process."""
    if not SUPABASE_URL or "YOUR_SUPABASE_URL" in SUPABASE_URL:
        print("ERROR: Please update the SUPABASE_URL in the script.")
        return
    if not SUPABASE_SERVICE_KEY or "YOUR_SUPABASE_SERVICE_ROLE_KEY" in SUPABASE_SERVICE_KEY:
        print("ERROR: Please update the SUPABASE_SERVICE_KEY. Use the secret 'service_role' key.")
        return

    supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    
    tickers = get_tickers_from_supabase(supabase)
    if not tickers:
        return

    data_to_upload = download_and_prepare_data(tickers)
    
    if data_to_upload:
        print(f"\nTotal rows to upload: {len(data_to_upload)}. Uploading to Supabase...")
        
        # Using 500 to remain safe, but adding sleep and retry logic
        batch_size = 500
        total_batches = (len(data_to_upload) - 1) // batch_size + 1
        
        for i in range(0, len(data_to_upload), batch_size):
            batch = data_to_upload[i:i + batch_size]
            current_batch_num = i // batch_size + 1
            print(f"Uploading batch {current_batch_num} of {total_batches}...")
            
            # --- RETRY LOGIC ---
            max_retries = 5
            for attempt in range(max_retries):
                try:
                    # Attempt the upload
                    response = supabase.table('stock_data').upsert(batch, on_conflict='date,symbol').execute()
                    
                    # Check for API-level errors that didn't raise an exception
                    # (supabase-py usually raises exceptions for network issues, but we check response too)
                    if hasattr(response, 'error') and response.error:
                         raise Exception(f"API Error: {response.error.message}")

                    # If successful, sleep briefly to throttle speed and break the retry loop
                    time.sleep(0.5) 
                    break 

                except Exception as e:
                    print(f"  [!] Error on batch {current_batch_num}, attempt {attempt + 1}: {e}")
                    
                    if attempt < max_retries - 1:
                        wait_time = 5 * (attempt + 1) # Incremental backoff (5s, 10s, 15s...)
                        print(f"  Waiting {wait_time} seconds before retrying...")
                        time.sleep(wait_time)
                    else:
                        print(f"  [X] Max retries reached. Skipping batch {current_batch_num} (Data gap created).")

        print("\nData ingestion process complete!")
    else:
        print("\nNo new data was prepared for upload.")

if __name__ == "__main__":
    main()
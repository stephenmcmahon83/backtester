import pandas_market_calendars as mcal
import pandas as pd
from supabase import create_client, Client
import os

# --- CONFIGURE YOUR DETAILS HERE ---
# Find these in your Supabase Project -> Settings -> API
SUPABASE_URL = "https://pbjmajhocspvtobjcksf.supabase.co"
# IMPORTANT: Use the 'service_role' key from your API settings. It's a secret key.
SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBiam1hamhvY3NwdnRvYmpja3NmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Mzc5NDAzOCwiZXhwIjoyMDY5MzcwMDM4fQ.t6mbbFNeuO87IS9dn-UXZ5xBCy-SmGMnpkay7cA7CNI"

# Years you want to generate data for.
START_YEAR = 1960
END_YEAR = 2030 # It's good to go a few years into the future.
# -----------------------------------

def populate_market_calendar():
    """
    Generates accurate NYSE trading day data and upserts it into a Supabase table.
    """
    if not SUPABASE_URL or "YOUR_SUPABASE_URL" in SUPABASE_URL:
        print("ERROR: Please update the SUPABASE_URL in the script.")
        return
    if not SUPABASE_SERVICE_KEY or "YOUR_SUPABASE_SERVICE_ROLE_KEY" in SUPABASE_SERVICE_KEY:
        print("ERROR: Please update the SUPABASE_SERVICE_KEY in the script. Use the secret 'service_role' key.")
        return

    try:
        # 1. Initialize Supabase client
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
        print("Successfully connected to Supabase.")

        # 2. Get the NYSE calendar
        nyse = mcal.get_calendar('NYSE')

        # 3. Generate valid trading days for the specified year range
        print(f"Generating calendar data from {START_YEAR} to {END_YEAR}...")
        schedule = nyse.schedule(start_date=f'{START_YEAR}-01-01', end_date=f'{END_YEAR}-12-31')
        trading_days_series = schedule.index.to_series()

        # 4. Create a DataFrame and calculate trading_day_of_year
        df = pd.DataFrame(trading_days_series, columns=['date'])
        df['date'] = df['date'].dt.date
        df['year'] = pd.to_datetime(df['date']).dt.year
        df['trading_day_of_year'] = df.groupby('year').cumcount() + 1
        print(f"Generated {len(df)} total trading days.")

        # 5. Prepare data for insertion (list of dictionaries)
        data_to_insert = df.to_dict(orient='records')
        
        # Convert date objects to string format 'YYYY-MM-DD' for JSON serialization
        for row in data_to_insert:
            row['date'] = row['date'].strftime('%Y-%m-%d')

        # 6. Insert the data into the Supabase table
        print("Uploading data to Supabase... (This may take a moment)")
        # The upsert method is safe to run multiple times.
        response = supabase.table('market_calendar').upsert(data_to_insert).execute()

        # 7. Check for errors
        if response.data:
            print(f"Successfully upserted {len(response.data)} rows into the 'market_calendar' table.")
        else:
            print("An error occurred:")
            print(response)

    except Exception as e:
        print(f"An unexpected error occurred: {e}")

if __name__ == "__main__":
    populate_market_calendar()
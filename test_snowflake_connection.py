import snowflake.connector
import os
import sys

def test_connection():
    account = os.getenv("SNOWFLAKE_ACCOUNT", "")
    username = os.getenv("SNOWFLAKE_USER", "")
    password = os.getenv("SNOWFLAKE_PASSWORD", "")
    warehouse = os.getenv("SNOWFLAKE_WAREHOUSE", "MIAS_DATA_DB")
    
    print(f"Testing connection with account: {account}")
    print(f"Username: {username}")
    print(f"Warehouse: {warehouse}")
    
    # Test different account identifier formats
    test_formats = [
        account,  # Original format
        account.replace(".snowflakecomputing.com", "") if ".snowflakecomputing.com" in account else account + ".snowflakecomputing.com",
        account.split('.')[0] if '.' in account else account,
        f"{account}.us-east-1",
        f"{account}.us-west-2",
        f"{account}.eu-west-1"
    ]
    
    for i, account_format in enumerate(test_formats):
        print(f"\nAttempt {i+1}: Testing account format: {account_format}")
        try:
            conn = snowflake.connector.connect(
                account=account_format,
                user=username,
                password=password,
                warehouse=warehouse,
                database='MIAS_DATA_DB',
                schema='PUBLIC',
                timeout=10
            )
            
            # Test a simple query
            cursor = conn.cursor()
            cursor.execute("SELECT CURRENT_WAREHOUSE(), CURRENT_DATABASE(), CURRENT_SCHEMA()")
            result = cursor.fetchone()
            
            print(f"SUCCESS! Connected with account format: {account_format}")
            print(f"Current warehouse: {result[0]}")
            print(f"Current database: {result[1]}")
            print(f"Current schema: {result[2]}")
            
            # Test if we can see tables
            cursor.execute("SHOW TABLES IN SCHEMA MIAS_DATA_DB.PUBLIC")
            tables = cursor.fetchall()
            print(f"Found {len(tables)} tables in MIAS_DATA_DB.PUBLIC")
            
            cursor.close()
            conn.close()
            return account_format
            
        except Exception as e:
            print(f"Failed with error: {str(e)}")
            continue
    
    print("\nAll connection attempts failed.")
    return None

if __name__ == "__main__":
    successful_format = test_connection()
    if successful_format:
        print(f"\nUse this account format: {successful_format}")
    else:
        print("\nConnection failed with all formats. Please check your credentials.")
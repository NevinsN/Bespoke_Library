import os
import pymongo
from dotenv import load_dotenv
from pymongo.errors import ConnectionFailure

# Load .env file
load_dotenv()

# Retrieve COSMOS_CONNECTION_STRING from environment variables
connecttion_string = os.getenv("COSMOS_CONNECTION_STRING")

def test_connection():
    if not connecttion_string:
        print("COSMOS_CONNECTION_STRING is not set in the environment variables.")
        return
    
    try:
        # Initialize client
        client = pymongo.MongoClient(connecttion_string)

        #Uses admin.command to check the connection
        client.admin.command('ping')

        print("Connection to MongoDB successful!")

        # Check contents
        dbs = client.list_database_names()
        print(f"Databases: {dbs}")

    except Exception as e:
        print(f"Failed to connect to MongoDB: {e}")

if __name__ == "__main__":
    test_connection()
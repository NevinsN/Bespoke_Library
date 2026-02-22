from pymongo import MongoClient
import os

COSMOS_CONN = os.environ.get("COSMOS_CONNECTION_STRING")

client = MongoClient(COSMOS_CONN)
db = client.get_database("bespoke")
# utils/response.py

import json
import azure.functions as func

def ok(data):
    return func.HttpResponse(
        json.dumps({"success": True, "data": data}),
        status_code=200,
        mimetype="application/json"
    )

def error(message, code=500):
    return func.HttpResponse(
        json.dumps({"success": False, "error": message}),
        status_code=code,
        mimetype="application/json"
    )
import json
import azure.functions as func

def ok(data, meta=None):
    payload = {
        "success": True,
        "data": data
    }
    if meta:
        payload["meta"] = meta
    return func.HttpResponse(
        body=json.dumps(payload),
        status_code=200,
        mimetype="application/json"
    )

def error(message, code=500):
    return func.HttpResponse(
        body=json.dumps({"success": False, "error": message}),
        status_code=code,
        mimetype="application/json"
    )
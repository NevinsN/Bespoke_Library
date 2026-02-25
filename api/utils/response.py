from flask import jsonify

def ok(data, meta=None):
    payload = {"success": True, "data": data}
    if meta:
        payload["meta"] = meta
    return jsonify(payload), 200

def error(message, code=500):
    return jsonify({"success": False, "error": message}), code

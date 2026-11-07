"""Deployment-only readiness endpoint; preserve the website API contract."""
from flask import jsonify
from app import app, classifier


@app.get('/api/ready')
def ready():
    available = classifier.available
    return jsonify(available=available), 200 if available else 503

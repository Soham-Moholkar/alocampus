from flask import Flask, request, jsonify
from flask_cors import CORS
from sklearn.ensemble import IsolationForest
import pandas as pd
import numpy as np
import joblib
import os

app = Flask(__name__)
CORS(app)

# Dummy model file path
MODEL_PATH = 'trust_model.pkl'

# Initialize or load model
if os.path.exists(MODEL_PATH):
    clf = joblib.load(MODEL_PATH)
    print("Loaded existing model.")
else:
    print("Training initial model...")
    # Generate synthetic training data (normal behavior)
    # Features: [grade_value, time_taken_days, peer_comparison_score, issuer_trust_score]
    X_train = np.random.normal(loc=[3.5, 90, 0.8, 95], scale=[0.5, 10, 0.1, 5], size=(1000, 4))
    
    # Add some anomalies
    X_outliers = np.random.uniform(low=[0, 0, 0, 0], high=[4.0, 10, 1.0, 50], size=(100, 4))
    
    X = np.vstack([X_train, X_outliers])
    
    clf = IsolationForest(random_state=42, contamination=0.1)
    clf.fit(X)
    joblib.dump(clf, MODEL_PATH)
    print("Model trained and saved.")

@app.route('/analyze-credential', methods=['POST'])
def analyze_credential():
    try:
        data = request.json
        
        # Extract features (assume they are passed in the request)
        # Features: [grade_value, time_taken_days, peer_comparison_score, issuer_trust_score]
        features = [
            data.get('grade_value', 0.0),
            data.get('time_taken_days', 0),
            data.get('peer_comparison_score', 0.0),
            data.get('issuer_trust_score', 0)
        ]
        
        # Reshape for prediction
        X_input = np.array(features).reshape(1, -1)
        
        # Predict: 1 for inlier, -1 for outlier
        prediction = clf.predict(X_input)[0]
        
        # Score calculation (simple logic based on anomaly score)
        # decision_function returns anomaly score. Lower is more anomalous.
        score = clf.decision_function(X_input)[0]
        
        # Normalize score to 0-100 roughly
        # This is a heuristic normalization for the demo
        trust_score = max(0, min(100, (score + 0.2) * 200)) # Adjust as needed
        
        is_anomaly = True if prediction == -1 else False
        
        return jsonify({
            "trust_score": int(trust_score),
            "is_anomaly": is_anomaly,
            "raw_score": float(score)
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "ok", "model_loaded": clf is not None})

if __name__ == '__main__':
    app.run(port=5000, debug=True)

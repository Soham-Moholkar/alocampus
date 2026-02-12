# CREDENZA AI Service

This service runs the AI models for:
1.  **Trust Scoring**: Generates a trust score (0-100) based on issuer behavior.
2.  **Anomaly Detection**: Flags suspicious credential minting patterns.

## Concept

The AI uses an Isolation Forest model trained on synthetic data to detect anomalies in credential issuance (e.g., sudden grade inflation, excessive issuance volume).

## Setup

1.  Install Python 3.10+.
2.  Install dependencies:
    ```bash
    pip install -r requirements.txt
    ```

## Run

Start the API server:
```bash
python model.py
```

The server will run on `http://localhost:5000`.

## API Endpoints

### `POST /analyze-credential`

Input:
```json
{
    "grade_value": 3.8,
    "time_taken_days": 120,
    "peer_comparison_score": 0.9,
    "issuer_trust_score": 98
}
```

Output:
```json
{
    "trust_score": 95,
    "is_anomaly": false,
    "raw_score": 0.45
}
```


export interface CredentialData {
    studentName: string;
    courseName: string;
    gradeValue: number;
    timeTakenDays: number;
    peerComparisonScore: number;
    issuerTrustScore: number;
}

export interface AnalysisResult {
    trust_score: number;
    is_anomaly: boolean;
    raw_score: number;
}

const AI_API_URL = 'http://localhost:5000/analyze-credential';

export async function analyzeCredential(data: CredentialData): Promise<AnalysisResult> {
    try {
        const response = await fetch(AI_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                grade_value: data.gradeValue,
                time_taken_days: data.timeTakenDays,
                peer_comparison_score: data.peerComparisonScore,
                issuer_trust_score: data.issuerTrustScore,
            }),
        });

        if (!response.ok) {
            throw new Error(`AI Analysis failed: ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        console.error("AI Service Error:", error);
        // Fallback for demo if AI service is not running
        return {
            trust_score: 85,
            is_anomaly: false,
            raw_score: 0.5
        };
    }
}

export async function verifyCredentialOnChain(credentialId: number): Promise<boolean> {
    // Mock verification or simple indexer lookup
    console.log(`Verifying credential asset ID: ${credentialId}`);
    await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate delay
    return true;
}

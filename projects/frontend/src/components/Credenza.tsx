import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { useWallet } from '@txnlab/use-wallet-react'
import { useSnackbar } from 'notistack'
import { useMemo, useState } from 'react'
import { getAlgodConfigFromViteEnvironment } from '../utils/network/getAlgoClientConfigs'
import { pinJSONToIPFS, ipfsHttpUrl } from '../utils/pinata'
import { analyzeCredential, AnalysisResult } from '../utils/credential'

interface CredenzaProps {
    openModal: boolean
    closeModal: () => void
}

const Credenza = ({ openModal, closeModal }: CredenzaProps) => {
    const { activeAddress, transactionSigner } = useWallet()
    const { enqueueSnackbar } = useSnackbar()
    const [mode, setMode] = useState<'issuer' | 'recruiter'>('issuer')

    // Issuer Form
    const [studentName, setStudentName] = useState('')
    const [courseName, setCourseName] = useState('')
    const [gradeValue, setGradeValue] = useState(3.5)
    const [timeTakenDays, setTimeTakenDays] = useState(120)
    const [peerScore, setPeerScore] = useState(0.85)
    const [issuerTrust, setIssuerTrust] = useState(95)

    // State
    const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null)
    const [loading, setLoading] = useState(false)
    const [mintedAssetId, setMintedAssetId] = useState<string | null>(null)

    // Recruiter
    const [lookupAssetId, setLookupAssetId] = useState('')
    const [verifyResult, setVerifyResult] = useState<string | null>(null)

    const algorand = useMemo(() => {
        const algodConfig = getAlgodConfigFromViteEnvironment()
        const client = AlgorandClient.fromConfig({ algodConfig })
        client.setDefaultSigner(transactionSigner)
        return client
    }, [transactionSigner])

    // --- AI Analysis ---
    const handleAnalyze = async () => {
        setLoading(true)
        setAnalysisResult(null)
        try {
            const result = await analyzeCredential({
                studentName,
                courseName,
                gradeValue,
                timeTakenDays,
                peerComparisonScore: peerScore,
                issuerTrustScore: issuerTrust,
            })
            setAnalysisResult(result)
            if (result.is_anomaly) {
                enqueueSnackbar('⚠️ Anomaly detected – credential flagged!', { variant: 'warning' })
            } else {
                enqueueSnackbar('✅ Credential pattern verified. Ready to mint.', { variant: 'success' })
            }
        } catch (e) {
            enqueueSnackbar((e as Error).message, { variant: 'error' })
        } finally {
            setLoading(false)
        }
    }

    // --- Real ASA Minting ---
    const handleMint = async () => {
        if (!activeAddress) return enqueueSnackbar('Connect a wallet first', { variant: 'error' })
        if (!analysisResult || analysisResult.is_anomaly) return

        setLoading(true)
        try {
            // 1) Build ARC-3 metadata
            const metadata = {
                name: `CREDENZA: ${courseName}`,
                description: `Academic credential for ${studentName}`,
                properties: {
                    standard: 'CREDENZA-v1',
                    student_name: studentName,
                    course_name: courseName,
                    grade_value: gradeValue,
                    time_taken_days: timeTakenDays,
                    ai_trust_score: analysisResult.trust_score,
                    ai_anomaly_flag: analysisResult.is_anomaly,
                    ai_raw_score: analysisResult.raw_score,
                    issuer_address: activeAddress,
                    issued_at: new Date().toISOString(),
                },
            }

            // 2) Upload metadata to IPFS (if Pinata JWT is configured)
            let metadataUrl = ''
            try {
                const jsonPin = await pinJSONToIPFS(metadata)
                metadataUrl = `${ipfsHttpUrl(jsonPin.IpfsHash)}#arc3`
            } catch {
                // Fallback: store metadata in note field if no Pinata
                metadataUrl = `credenza://credential/${studentName}/${courseName}`
                enqueueSnackbar('Pinata not configured – using on-chain note instead', { variant: 'info' })
            }

            // 3) Compute metadata hash
            const metaBytes = new TextEncoder().encode(JSON.stringify(metadata))
            const digest = await crypto.subtle.digest('SHA-256', metaBytes)
            const metadataHash = new Uint8Array(digest)

            // 4) Create ASA (credential NFT)
            const unitName = 'CRED'
            const assetName = `CRED-${courseName.slice(0, 20)}`

            const result = await algorand.send.assetCreate({
                sender: activeAddress,
                total: 1n,
                decimals: 0,
                unitName,
                assetName,
                manager: activeAddress,
                reserve: activeAddress,
                url: metadataUrl,
                metadataHash,
                defaultFrozen: false,
                note: JSON.stringify({ credenza: metadata.properties }),
            })

            const assetId = String(result.assetId)
            setMintedAssetId(assetId)
            enqueueSnackbar(`🎉 Credential minted! ASA ID: ${assetId}`, { variant: 'success' })
        } catch (e) {
            enqueueSnackbar(`Mint failed: ${(e as Error).message}`, { variant: 'error' })
        } finally {
            setLoading(false)
        }
    }

    // --- Recruiter Verification ---
    const handleVerify = async () => {
        if (!lookupAssetId) return enqueueSnackbar('Enter an Asset ID', { variant: 'error' })
        setLoading(true)
        setVerifyResult(null)
        try {
            const algodConfig = getAlgodConfigFromViteEnvironment()
            const client = AlgorandClient.fromConfig({ algodConfig })
            const assetInfo = await client.client.algod.getAssetByID(Number(lookupAssetId)).do()

            const params = assetInfo as Record<string, unknown>
            const name = (params['name'] as string) || 'Unknown'
            const url = (params['url'] as string) || ''
            const creator = (params['creator'] as string) || 'Unknown'
            const total = (params['total'] as number) || 0

            if (name.startsWith('CRED-')) {
                setVerifyResult(
                    `✅ VALID CREDENZA Credential\n` +
                    `Asset: ${name}\n` +
                    `Creator (Issuer): ${creator}\n` +
                    `Total Supply: ${total}\n` +
                    `Metadata: ${url}`
                )
                enqueueSnackbar('Credential verified on-chain!', { variant: 'success' })
            } else {
                setVerifyResult(`⚠️ Asset found but not a CREDENZA credential.\nName: ${name}`)
                enqueueSnackbar('Not a CREDENZA credential', { variant: 'warning' })
            }
        } catch (e) {
            setVerifyResult(`❌ Could not find asset: ${(e as Error).message}`)
            enqueueSnackbar('Verification failed', { variant: 'error' })
        } finally {
            setLoading(false)
        }
    }

    if (!openModal) return null

    return (
        <dialog className="modal modal-open">
            <div className="modal-box w-11/12 max-w-3xl bg-base-100">
                <form method="dialog">
                    <button className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2" onClick={closeModal}>
                        ✕
                    </button>
                </form>

                <h3 className="font-bold text-2xl mb-2 text-center">🎓 CREDENZA</h3>
                <p className="text-center text-sm text-gray-500 mb-4">AI-Powered Academic Credential Verification on Algorand</p>

                {/* Tabs */}
                <div className="tabs tabs-boxed mb-6 justify-center">
                    <a className={`tab ${mode === 'issuer' ? 'tab-active' : ''}`} onClick={() => setMode('issuer')}>
                        🏫 University Issuer
                    </a>
                    <a className={`tab ${mode === 'recruiter' ? 'tab-active' : ''}`} onClick={() => setMode('recruiter')}>
                        🔍 Recruiter / Verifier
                    </a>
                </div>

                {/* ============ ISSUER MODE ============ */}
                {mode === 'issuer' && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="form-control">
                                <label className="label"><span className="label-text">Student Name</span></label>
                                <input type="text" className="input input-bordered" value={studentName} onChange={(e) => setStudentName(e.target.value)} placeholder="Jane Doe" />
                            </div>
                            <div className="form-control">
                                <label className="label"><span className="label-text">Course / Degree</span></label>
                                <input type="text" className="input input-bordered" value={courseName} onChange={(e) => setCourseName(e.target.value)} placeholder="Computer Science" />
                            </div>
                            <div className="form-control">
                                <label className="label"><span className="label-text">Grade (GPA 0-4)</span></label>
                                <input type="number" step="0.1" min="0" max="4" className="input input-bordered" value={gradeValue} onChange={(e) => setGradeValue(parseFloat(e.target.value))} />
                            </div>
                            <div className="form-control">
                                <label className="label"><span className="label-text">Time Taken (Days)</span></label>
                                <input type="number" className="input input-bordered" value={timeTakenDays} onChange={(e) => setTimeTakenDays(parseInt(e.target.value))} />
                            </div>
                        </div>

                        {/* AI Analysis Card */}
                        <div className="card bg-base-200 p-4">
                            <h4 className="font-bold mb-2">🤖 AI Fraud Detection</h4>
                            <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                                <p>Peer Comparison: <strong>{peerScore}</strong></p>
                                <p>Issuer Trust: <strong>{issuerTrust}</strong></p>
                            </div>

                            {analysisResult && (
                                <div className={`alert ${analysisResult.is_anomaly ? 'alert-warning' : 'alert-success'} mb-3`}>
                                    <div>
                                        <h3 className="font-bold">{analysisResult.is_anomaly ? '⚠️ Anomaly Detected' : '✅ Pattern Verified'}</h3>
                                        <p className="text-xs">Trust Score: {analysisResult.trust_score} | Raw: {analysisResult.raw_score.toFixed(4)}</p>
                                    </div>
                                </div>
                            )}

                            {mintedAssetId && (
                                <div className="alert alert-info">
                                    <div>
                                        <p className="font-bold">🎉 Credential Minted!</p>
                                        <p className="text-xs font-mono">ASA ID: {mintedAssetId}</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex justify-end gap-2">
                            <button className={`btn btn-primary ${loading ? 'loading' : ''}`} onClick={handleAnalyze} disabled={loading || !studentName || !courseName}>
                                🔬 Analyze Pattern
                            </button>
                            <button
                                className={`btn btn-success ${loading ? 'loading' : ''}`}
                                onClick={handleMint}
                                disabled={loading || !analysisResult || analysisResult.is_anomaly || !activeAddress}
                            >
                                ⛓️ Mint on Algorand
                            </button>
                        </div>
                    </div>
                )}

                {/* ============ RECRUITER MODE ============ */}
                {mode === 'recruiter' && (
                    <div className="space-y-4 text-center">
                        <div className="form-control max-w-sm mx-auto">
                            <label className="label"><span className="label-text">Credential Asset ID</span></label>
                            <input
                                type="text"
                                className="input input-bordered"
                                value={lookupAssetId}
                                onChange={(e) => setLookupAssetId(e.target.value)}
                                placeholder="e.g. 747652603"
                            />
                        </div>

                        <button className={`btn btn-secondary w-full max-w-sm ${loading ? 'loading' : ''}`} onClick={handleVerify} disabled={loading}>
                            🔍 Verify Credential On-Chain
                        </button>

                        {verifyResult && (
                            <div className="alert alert-info text-left mt-4">
                                <pre className="whitespace-pre-wrap text-xs">{verifyResult}</pre>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </dialog>
    )
}

export default Credenza

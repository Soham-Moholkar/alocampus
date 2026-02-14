import algosdk from 'algosdk'

interface AbiExecuteInput {
  algodClient: algosdk.Algodv2
  transactionSigner: algosdk.TransactionSigner
  sender: string
  appId: number
  methodSignature: string
  args: algosdk.ABIArgument[]
  waitRounds?: number
}

export interface AbiExecuteResult<T = unknown> {
  txId: string
  returnValue: T
}

const extractTxIds = (result: unknown): string[] => {
  if (!result || typeof result !== 'object') {
    return []
  }
  const maybe = result as Record<string, unknown>
  if (Array.isArray(maybe.txIDs)) {
    return maybe.txIDs as string[]
  }
  if (Array.isArray(maybe.tx_ids)) {
    return maybe.tx_ids as string[]
  }
  return []
}

const extractReturnValue = <T>(result: unknown): T => {
  if (!result || typeof result !== 'object') {
    return undefined as T
  }
  const maybe = result as Record<string, unknown>
  const methodResults = maybe.methodResults
  if (Array.isArray(methodResults) && methodResults.length > 0) {
    const first = methodResults[0] as Record<string, unknown>
    return first.returnValue as T
  }
  const abiResults = maybe.abiResults
  if (Array.isArray(abiResults) && abiResults.length > 0) {
    const first = abiResults[0] as Record<string, unknown>
    return first.returnValue as T
  }
  return undefined as T
}

export const executeAbiMethod = async <T = unknown>(input: AbiExecuteInput): Promise<AbiExecuteResult<T>> => {
  const method = algosdk.ABIMethod.fromSignature(input.methodSignature)
  const atc = new algosdk.AtomicTransactionComposer()
  const suggestedParams = await input.algodClient.getTransactionParams().do()

  atc.addMethodCall({
    appID: input.appId,
    method,
    sender: input.sender,
    suggestedParams,
    signer: input.transactionSigner,
    methodArgs: input.args,
  })

  const result = await atc.execute(input.algodClient, input.waitRounds ?? 4)
  const txIds = extractTxIds(result)

  return {
    txId: txIds[0] ?? '',
    returnValue: extractReturnValue<T>(result),
  }
}

interface SubmitPaymentInput {
  algodClient: algosdk.Algodv2
  signTransactions: (
    txnGroup: algosdk.Transaction[] | Uint8Array[] | (algosdk.Transaction[] | Uint8Array[])[],
    indexesToSign?: number[],
  ) => Promise<(Uint8Array | null)[]>
  sender: string
  receiver: string
  amountMicroAlgos: number
  note?: Uint8Array
}

export const submitPaymentTxn = async (input: SubmitPaymentInput): Promise<string> => {
  const params = await input.algodClient.getTransactionParams().do()
  const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    sender: input.sender,
    receiver: input.receiver,
    amount: input.amountMicroAlgos,
    note: input.note,
    suggestedParams: params,
  })

  const signed = await input.signTransactions([txn], [0])
  const raw = signed.filter((item): item is Uint8Array => item instanceof Uint8Array)
  if (raw.length === 0) {
    throw new Error('Transaction was not signed')
  }

  const sendResponse = await input.algodClient.sendRawTransaction(raw).do()
  if (typeof sendResponse === 'string') {
    return sendResponse
  }
  const maybe = sendResponse as { txId?: string; txid?: string }
  return maybe.txId ?? maybe.txid ?? ''
}

export const computeRoundStatus = (
  startRound: number,
  endRound: number,
  currentRound?: number,
): 'upcoming' | 'active' | 'closed' => {
  if (!currentRound || Number.isNaN(currentRound)) {
    return 'upcoming'
  }
  if (currentRound < startRound) {
    return 'upcoming'
  }
  if (currentRound > endRound) {
    return 'closed'
  }
  return 'active'
}

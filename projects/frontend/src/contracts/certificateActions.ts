import type algosdk from 'algosdk'

import { executeAbiMethod } from '../lib/abi'

interface CertificateCallContext {
  algodClient: algosdk.Algodv2
  transactionSigner: algosdk.TransactionSigner
  sender: string
  appId: number
}

export interface CertificateVerifyPayload {
  recipient: string
  assetId: number
  issuedTs: number
}

export const verifyCertificateOnChain = async (
  ctx: CertificateCallContext,
  certHashBytes: Uint8Array,
): Promise<CertificateVerifyPayload> => {
  const result = await executeAbiMethod<[string, number | bigint, number | bigint]>({
    ...ctx,
    methodSignature: 'verify_cert(byte[])(address,uint64,uint64)',
    args: [certHashBytes as unknown as algosdk.ABIArgument],
    waitRounds: 2,
  })

  const tuple = result.returnValue ?? ['', 0, 0]
  return {
    recipient: tuple[0],
    assetId: Number(tuple[1]),
    issuedTs: Number(tuple[2]),
  }
}

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

export const recordCertificateAiIntent = async (
  ctx: CertificateCallContext,
  intentHash: Uint8Array,
  expiresRound: number,
): Promise<{ txId: string; returnValue: boolean }> =>
  executeAbiMethod<boolean>({
    ...ctx,
    methodSignature: 'record_ai_intent(byte[],uint64)bool',
    args: [
      intentHash as unknown as algosdk.ABIArgument,
      BigInt(expiresRound) as unknown as algosdk.ABIArgument,
    ],
  })

export const registerCertificateAi = async (
  ctx: CertificateCallContext,
  certHashBytes: Uint8Array,
  recipient: string,
  assetId: number,
  issuedTs: number,
  intentHash: Uint8Array,
): Promise<{ txId: string; returnValue: boolean }> =>
  executeAbiMethod<boolean>({
    ...ctx,
    methodSignature: 'register_cert_ai(byte[],address,uint64,uint64,byte[])bool',
    args: [
      certHashBytes as unknown as algosdk.ABIArgument,
      recipient as unknown as algosdk.ABIArgument,
      BigInt(assetId) as unknown as algosdk.ABIArgument,
      BigInt(issuedTs) as unknown as algosdk.ABIArgument,
      intentHash as unknown as algosdk.ABIArgument,
    ],
  })

export const mintAndRegisterCertificateAi = async (
  ctx: CertificateCallContext,
  certHashBytes: Uint8Array,
  recipient: string,
  metadataUrl: string,
  issuedTs: number,
  intentHash: Uint8Array,
): Promise<{ txId: string; returnValue: number | bigint }> =>
  executeAbiMethod<number | bigint>({
    ...ctx,
    methodSignature: 'mint_and_register_ai(byte[],address,string,uint64,byte[])uint64',
    args: [
      certHashBytes as unknown as algosdk.ABIArgument,
      recipient as unknown as algosdk.ABIArgument,
      metadataUrl as unknown as algosdk.ABIArgument,
      BigInt(issuedTs) as unknown as algosdk.ABIArgument,
      intentHash as unknown as algosdk.ABIArgument,
    ],
  })

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

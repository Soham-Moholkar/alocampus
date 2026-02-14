import type algosdk from 'algosdk'

import { executeAbiMethod } from '../lib/abi'

interface AttendanceCallContext {
  algodClient: algosdk.Algodv2
  transactionSigner: algosdk.TransactionSigner
  sender: string
  appId: number
}

export const checkIn = async (
  ctx: AttendanceCallContext,
  sessionId: number,
): Promise<{ txId: string; returnValue: boolean }> =>
  executeAbiMethod<boolean>({
    ...ctx,
    methodSignature: 'check_in(uint64)bool',
    args: [BigInt(sessionId) as unknown as algosdk.ABIArgument],
  })

export const isPresent = async (
  ctx: AttendanceCallContext,
  sessionId: number,
  address: string,
): Promise<boolean> => {
  const result = await executeAbiMethod<boolean>({
    ...ctx,
    methodSignature: 'is_present(uint64,address)bool',
    args: [
      BigInt(sessionId) as unknown as algosdk.ABIArgument,
      address as unknown as algosdk.ABIArgument,
    ],
    waitRounds: 2,
  })
  return Boolean(result.returnValue)
}

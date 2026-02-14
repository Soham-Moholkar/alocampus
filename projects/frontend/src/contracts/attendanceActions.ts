import type algosdk from 'algosdk'

import { executeAbiMethod } from '../lib/abi'

interface AttendanceCallContext {
  algodClient: algosdk.Algodv2
  transactionSigner: algosdk.TransactionSigner
  sender: string
  appId: number
}

export const recordAttendanceAiIntent = async (
  ctx: AttendanceCallContext,
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

export const createSessionAi = async (
  ctx: AttendanceCallContext,
  courseCode: string,
  sessionTs: number,
  openRound: number,
  closeRound: number,
  intentHash: Uint8Array,
): Promise<{ txId: string; returnValue: number | bigint }> =>
  executeAbiMethod<number | bigint>({
    ...ctx,
    methodSignature: 'create_session_ai(string,uint64,uint64,uint64,byte[])uint64',
    args: [
      courseCode as unknown as algosdk.ABIArgument,
      BigInt(sessionTs) as unknown as algosdk.ABIArgument,
      BigInt(openRound) as unknown as algosdk.ABIArgument,
      BigInt(closeRound) as unknown as algosdk.ABIArgument,
      intentHash as unknown as algosdk.ABIArgument,
    ],
  })

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

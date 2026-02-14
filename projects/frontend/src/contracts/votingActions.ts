import type algosdk from 'algosdk'

import { executeAbiMethod } from '../lib/abi'

interface VotingCallContext {
  algodClient: algosdk.Algodv2
  transactionSigner: algosdk.TransactionSigner
  sender: string
  appId: number
}

export const castVote = async (
  ctx: VotingCallContext,
  pollId: number,
  optionIndex: number,
): Promise<{ txId: string; returnValue: boolean }> =>
  executeAbiMethod<boolean>({
    ...ctx,
    methodSignature: 'cast_vote(uint64,uint64)bool',
    args: [
      BigInt(pollId) as unknown as algosdk.ABIArgument,
      BigInt(optionIndex) as unknown as algosdk.ABIArgument,
    ],
  })

export const getPollResult = async (
  ctx: VotingCallContext,
  pollId: number,
  optionIndex: number,
): Promise<number> => {
  const result = await executeAbiMethod<number>({
    ...ctx,
    methodSignature: 'get_result(uint64,uint64)uint64',
    args: [
      BigInt(pollId) as unknown as algosdk.ABIArgument,
      BigInt(optionIndex) as unknown as algosdk.ABIArgument,
    ],
    waitRounds: 2,
  })
  return Number(result.returnValue ?? 0)
}

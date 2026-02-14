import type algosdk from 'algosdk'

import { executeAbiMethod } from '../lib/abi'

interface VotingCallContext {
  algodClient: algosdk.Algodv2
  transactionSigner: algosdk.TransactionSigner
  sender: string
  appId: number
}

export const recordVotingAiIntent = async (
  ctx: VotingCallContext,
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

export const createPollAi = async (
  ctx: VotingCallContext,
  question: string,
  options: string[],
  startRound: number,
  endRound: number,
  intentHash: Uint8Array,
): Promise<{ txId: string; returnValue: number | bigint }> =>
  executeAbiMethod<number | bigint>({
    ...ctx,
    methodSignature: 'create_poll_ai(string,string[],uint64,uint64,byte[])uint64',
    args: [
      question as unknown as algosdk.ABIArgument,
      options as unknown as algosdk.ABIArgument,
      BigInt(startRound) as unknown as algosdk.ABIArgument,
      BigInt(endRound) as unknown as algosdk.ABIArgument,
      intentHash as unknown as algosdk.ABIArgument,
    ],
  })

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

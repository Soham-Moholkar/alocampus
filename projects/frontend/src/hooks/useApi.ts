import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  pollsApi,
  sessionsApi,
  certsApi,
  adminApi,
  analyticsApi,
  txApi,
  healthApi,
  type CreatePollPayload,
  type CreateSessionPayload,
  type IssueCertPayload,
  type SetRolePayload,
} from '@/lib/api';

// ── Polls ───────────────────────────────────────────────

export function usePolls() {
  return useQuery({
    queryKey: ['polls'],
    queryFn: () => pollsApi.list().then((r) => r.data),
    staleTime: 30_000,
  });
}

export function usePoll(id: number) {
  return useQuery({
    queryKey: ['polls', id],
    queryFn: () => pollsApi.get(id).then((r) => r.data),
    enabled: id > 0,
  });
}

export function useCreatePoll() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreatePollPayload) =>
      pollsApi.create(data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['polls'] }),
  });
}

// ── Sessions ────────────────────────────────────────────

export function useSessions() {
  return useQuery({
    queryKey: ['sessions'],
    queryFn: () => sessionsApi.list().then((r) => r.data),
    staleTime: 30_000,
  });
}

export function useSession(id: number) {
  return useQuery({
    queryKey: ['sessions', id],
    queryFn: () => sessionsApi.get(id).then((r) => r.data),
    enabled: id > 0,
  });
}

export function useCreateSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateSessionPayload) =>
      sessionsApi.create(data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sessions'] }),
  });
}

// ── Certificates ────────────────────────────────────────

export function useCerts() {
  return useQuery({
    queryKey: ['certs'],
    queryFn: () => certsApi.list().then((r) => r.data),
    staleTime: 60_000,
  });
}

export function useVerifyCert(certHash: string) {
  return useQuery({
    queryKey: ['cert-verify', certHash],
    queryFn: () => certsApi.verify(certHash).then((r) => r.data),
    enabled: !!certHash,
  });
}

export function useIssueCert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: IssueCertPayload) =>
      certsApi.issue(data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['certs'] }),
  });
}

// ── Admin ───────────────────────────────────────────────

export function useSetRole() {
  return useMutation({
    mutationFn: (data: SetRolePayload) =>
      adminApi.setRole(data).then((r) => r.data),
  });
}

// ── Analytics ───────────────────────────────────────────

export function useAnalytics() {
  return useQuery({
    queryKey: ['analytics'],
    queryFn: () => analyticsApi.summary().then((r) => r.data),
    staleTime: 60_000,
  });
}

// ── Transactions ────────────────────────────────────────

export function useTrackTx() {
  return useMutation({
    mutationFn: ({ txId, kind }: { txId: string; kind: string }) =>
      txApi.track(txId, kind).then((r) => r.data),
  });
}

export function useTxStatus(txId: string) {
  return useQuery({
    queryKey: ['tx', txId],
    queryFn: () => txApi.status(txId).then((r) => r.data),
    enabled: !!txId,
    refetchInterval: (query) =>
      query.state.data?.status === 'pending' ? 3000 : false,
  });
}

// ── Health ──────────────────────────────────────────────

export function useHealthDetailed() {
  return useQuery({
    queryKey: ['health'],
    queryFn: () => healthApi.detailed().then((r) => r.data),
    staleTime: 30_000,
  });
}

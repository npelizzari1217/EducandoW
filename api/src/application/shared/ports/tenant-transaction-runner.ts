export interface TenantTransactionRunner {
  run<T>(work: () => Promise<T>): Promise<T>;
}

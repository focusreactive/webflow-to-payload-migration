export function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isRetryableStatus(status: number): boolean {
  return status === 429 || (status >= 500 && status < 600);
}

export function headersToRecord(headers: Headers): Record<string, string> {
  const record: Record<string, string> = {};

  for (const [key, value] of headers) {
    record[key] = value;
  }

  return record;
}

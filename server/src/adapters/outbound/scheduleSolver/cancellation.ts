/** Por que um `AbortSignal` abortou, sempre como `Error` (um `AbortError` sem motivo). */
export const reasonOf = (signal: AbortSignal): Error =>
  signal.reason instanceof Error
    ? signal.reason
    : new DOMException('This operation was aborted', 'AbortError');

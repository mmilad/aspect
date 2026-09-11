/** One request owner, bounded retries, and cancellation on disposal. */
export class RefreshLoop {
  private timer?: ReturnType<typeof setTimeout>;
  private abort?: AbortController;
  private failures = 0;
  private disposed = false;
  constructor(private readonly load: (signal: AbortSignal) => Promise<boolean>,
    private readonly failed: (error: unknown) => void) {}

  refresh() {
    this.failures = 0;
    clearTimeout(this.timer);
    this.abort?.abort();
    void this.tick();
  }

  private async tick() {
    if (this.disposed) return;
    const abort = new AbortController();
    this.abort = abort;
    try {
      const again = await this.load(abort.signal);
      if (abort.signal.aborted || this.disposed) return;
      this.failures = 0;
      if (again) this.timer = setTimeout(() => void this.tick(), 2000);
    } catch (error) {
      if (abort.signal.aborted || this.disposed) return;
      this.failed(error);
      if (++this.failures < 3 && !(error instanceof MissingRunError)) {
        this.timer = setTimeout(() => void this.tick(), 2000);
      }
    }
  }

  dispose() {
    this.disposed = true;
    this.abort?.abort();
    clearTimeout(this.timer);
  }
}

export class MissingRunError extends Error {}

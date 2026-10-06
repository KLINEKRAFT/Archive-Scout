export class TTLCache<T> {
  private values = new Map<string, { value: T; expires: number }>();
  constructor(
    private max = 150,
    private ttl = 300_000,
  ) {}
  get(key: string): T | undefined {
    const e = this.values.get(key);
    if (!e) return;
    if (e.expires < Date.now()) {
      this.values.delete(key);
      return;
    }
    return e.value;
  }
  set(key: string, value: T) {
    if (this.values.size >= this.max)
      this.values.delete(this.values.keys().next().value!);
    this.values.set(key, { value, expires: Date.now() + this.ttl });
    return value;
  }
}

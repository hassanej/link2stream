export function now(): Date {
    return new Date();
}

export function nowIso(): string {
    return now().toISOString();
}

export function timestamp(): string {
    return nowIso()
        .replace(/:/g, "-")
        .replace(/\..+/, "");
}
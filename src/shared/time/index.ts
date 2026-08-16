export type Clock = () => string;

export const currentIsoTimestamp: Clock = () => new Date().toISOString();

import type { EntityId } from '../../domain/diagram/types';

export type IdGenerator = () => EntityId;

export const generateEntityId: IdGenerator = () => crypto.randomUUID();

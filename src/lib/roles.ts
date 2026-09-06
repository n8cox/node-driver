import type { NodeRole } from '@/types/ensemble';

export const ROLE_LABEL: Record<NodeRole, string> = {
  human: 'human',
  hemisphere: 'hemisphere',
  connection: 'connection',
  motor: 'motor',
};

export function roleClass(role: NodeRole): string {
  return `role-${role}`;
}

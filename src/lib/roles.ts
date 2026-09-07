import type { NodeRole } from '@/types/ensemble';

export const ROLE_LABEL: Record<NodeRole, string> = {
  human: 'human',
  hemisphere: 'hemisphere',
  connection: 'connection',
  motor: 'motor',
};

/** Small mono glyphs paired with role labels — literal, not theatrical. */
export const ROLE_GLYPH: Record<NodeRole, string> = {
  human: '·',
  hemisphere: '◇',
  connection: '○',
  motor: '▶',
};

export function roleClass(role: NodeRole): string {
  return `role-${role}`;
}

import type { CommentOut, StaffCommentOut } from '@/lib/api/generated/model'

export function makeComment(overrides: Partial<CommentOut> = {}): CommentOut {
  return {
    id: 1,
    parent_id: null,
    depth: 0,
    status: 'published',
    body: 'Does the OCR pass catch scanned tables?',
    author: { id: 'a1', name: 'Ada', is_staff: false, is_vendor: false },
    created_at: '2026-10-01T10:00:00Z',
    edited_at: null,
    ...overrides,
  }
}

export function makeStaffComment(overrides: Partial<StaffCommentOut> = {}): StaffCommentOut {
  return {
    ...makeComment({ status: 'pending' }),
    target_type: 'tool',
    target_slug: 'pdf-redaction',
    target_title: 'PDF Redaction',
    parent_body: null,
    review_note: '',
    ...overrides,
  }
}

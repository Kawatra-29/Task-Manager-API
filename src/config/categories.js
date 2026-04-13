/**
 * DESIGN DECISION: Categories are user-created (dynamic), not pre-defined.
 *
 * Rationale: Pre-defined categories limit flexibility and require code changes
 * to add new ones. Dynamic categories stored per-user in PostgreSQL give each
 * user a personalised taxonomy while still allowing admins to seed defaults.
 *
 * Default seeds below are inserted for new users on first login (optional).
 */

const DEFAULT_CATEGORIES = [
  { name: 'Work',     color: '#4F46E5', icon: '💼' },
  { name: 'Personal', color: '#059669', icon: '🏠' },
  { name: 'Urgent',   color: '#DC2626', icon: '🔥' },
  { name: 'Learning', color: '#D97706', icon: '📚' },
  { name: 'Health',   color: '#7C3AED', icon: '❤️' },
];

module.exports = { DEFAULT_CATEGORIES };
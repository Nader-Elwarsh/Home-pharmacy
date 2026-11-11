export interface NavItem {
  to: string;
  label: string;
  icon: string;
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'الرئيسية', icon: '🏠' },
  { to: '/cabinet', label: 'الخزانة', icon: '💊' },
  { to: '/health', label: 'الصحة', icon: '📋' },
  { to: '/family', label: 'الأسرة', icon: '👪' },
  { to: '/more', label: 'المزيد', icon: '⋯' },
];

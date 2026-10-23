export const FinoraTheme = {
  colors: {
    // Primary Emerald Green Palette
    primary: '#059669',
    primaryDark: '#064E3B',
    primaryMedium: '#047857',
    primaryLight: '#10B981',
    primaryMuted: '#D1FAE5',
    primarySoft: '#ECFDF5',
    primaryGradientStart: '#064E3B',
    primaryGradientEnd: '#065F46',

    // Canvas & Cards
    background: '#F8FAF9',
    card: '#FFFFFF',
    cardBorder: '#E6ECE9',
    cardHover: '#F3F7F5',

    // Typography
    textPrimary: '#111827',
    textSecondary: '#6B7280',
    textMuted: '#9CA3AF',
    textWhite: '#FFFFFF',
    textWhiteMuted: '#A7F3D0',

    // Status / Category Accents
    success: '#10B981',
    warning: '#F59E0B',
    danger: '#EF4444',
    info: '#3B82F6',
    purple: '#8B5CF6',
    orange: '#F97316',
    amber: '#D97706',

    // Status attendance colors
    fullDay: '#10B981',
    halfDay: '#F59E0B',
    stopped: '#EF4444',

    // Misc
    inputBorder: '#E5E7EB',
    divider: '#F1F5F3',
  },
  shadows: {
    softCard: {
      shadowColor: '#064E3B',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.05,
      shadowRadius: 12,
      elevation: 2,
    },
    heroCard: {
      shadowColor: '#064E3B',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.25,
      shadowRadius: 20,
      elevation: 8,
    },
    actionCircle: {
      shadowColor: '#059669',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 6,
      elevation: 2,
    },
    floatingBar: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.08,
      shadowRadius: 16,
      elevation: 10,
    },
  },
  borderRadius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    full: 9999,
  },
};

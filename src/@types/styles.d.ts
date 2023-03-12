import 'styled-components';

declare module 'styled-components' {
  export interface DefaultTheme {
    COLORS: {
      PRIMARY: string;
      SECONDARY: string;
      TERTIARY: string;

      DISABLED: string;
      BACKGROUND: string;
      BACKGROUND_500: string;
      BACKGROUND_400: string;
      TEXT_PRIMARY: string;
      TEXT_SECONDARY: string;

      GOOD: string;
      BAD: string;
      CRITICAL: string;

      MORNING: string;
      AFTERNOON: string;
      NIGHT: string;

      BUSY: string;
      FREE: string;

      APPROVED: string;
      FAILED_BY_GRADE: string;
      FAILED_BY_ATTENDANCE: string;
      EXEMPT: string;
      CANCELED: string;

      ERROR: string;
      SUCCESS: string;
    };
    FONTS: {
      THIN: string;
      THIN_ITALIC: string;
      LIGHT: string;
      LIGHT_ITALIC: string;
      REGULAR: string;
      REGULAR_ITALIC: string;
      MEDIUM: string;
      MEDIUM_ITALIC: string;
      BOLD: string;
      BOLD_ITALIC: string;
    };
    FONT_SIZE: {
      XXS: string;
      XS: string;
      SM: string;
      MD: string;
      LG: string;
      XL: string;
      XXL: string;
    };
  }
}

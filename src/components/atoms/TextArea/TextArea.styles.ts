import styled, {DefaultTheme} from 'styled-components/native';

export type TextAreaProps = {
  size?: 'XXS' | 'XS' | 'SM' | 'MD' | 'LG' | 'XL' | 'XXL';
  color?: keyof DefaultTheme['COLORS'];
  alignSelf?: 'flex-start' | 'center' | 'flex-end';
  margin?: string;
  marginLeft?: string;
  marginRight?: string;
  marginTop?: string;
  marginBottom?: string;
  withoutMargin?: boolean;
};

export const Container = styled.ScrollView`
  display: flex;
  padding: 8px;
  min-height: 50px;

  border: solid 1px;
  border-radius: 12px;
  border-color: ${({theme}) => theme.COLORS.PRIMARY};
  background-color: ${({theme}) => theme.COLORS.BACKGROUND};

  elevation: 4;
`;

export const TextArea = styled.TextInput<TextAreaProps>`
  width: 100%;

  font-size: ${({size, theme}) =>
    size ? theme.FONT_SIZE[size] : theme.FONT_SIZE.MD};
  color: ${({theme}) => theme.COLORS.TEXT_PRIMARY};
  align-self: ${({alignSelf}) => (alignSelf ? alignSelf : 'flex-start')};
  margin-left: ${({marginLeft}) => (marginLeft ? marginLeft : '0px')};
  margin-right: ${({marginRight}) => (marginRight ? marginRight : '0px')};
  margin-top: ${({marginTop}) => (marginTop ? marginTop : '0px')};
  margin-bottom: ${({marginBottom}) => (marginBottom ? marginBottom : '0px')};
`;

export default TextArea;

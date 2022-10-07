import styled, {DefaultTheme} from 'styled-components/native';

type TextProps = {
  size?: 'XXS' | 'XS' | 'SM' | 'MD' | 'LG' | 'XL' | 'XXL';
  color?: keyof DefaultTheme['COLORS'];
  textAlign?: 'left' | 'center' | 'right';
  alignSelf?: 'flex-start' | 'center' | 'flex-end';
  margin?: string;
  marginLeft?: string;
  marginRight?: string;
  marginTop?: string;
  marginBottom?: string;
  italic?: boolean;
  weight?:
    | 'normal'
    | 'bold'
    | '100'
    | '200'
    | '300'
    | '400'
    | '500'
    | '600'
    | '700'
    | '800'
    | '900';
  underline?: boolean;
  withoutMargin?: boolean;
};

const Text = styled.Text<TextProps>`
  font-size: ${({size, theme}) =>
    size ? theme.FONT_SIZE[size] : theme.FONT_SIZE.MD};
  color: ${({color, theme}) =>
    color ? theme.COLORS[color] : theme.COLORS.TEXT_PRIMARY};
  font-style: ${({italic}) => (italic ? 'italic' : 'normal')};
  font-weight: ${({weight}) => weight || 'normal'};
  text-decoration: ${({underline}) => (underline ? 'underline' : 'none')};
  text-align: ${({textAlign}) => (textAlign ? textAlign : 'left')};
  align-self: ${({alignSelf}) => (alignSelf ? alignSelf : 'flex-start')};
  margin-left: ${({marginLeft}) => (marginLeft ? marginLeft : '0px')};
  margin-right: ${({marginRight}) => (marginRight ? marginRight : '0px')};
  margin-top: ${({marginTop}) => (marginTop ? marginTop : '0px')};
  margin-bottom: ${({marginBottom}) => (marginBottom ? marginBottom : '0px')};
`;

export default Text;

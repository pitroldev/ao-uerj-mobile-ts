import styled from 'styled-components/native';

export const ModalOverlay = styled.View`
  flex: 1;
  background-color: rgba(0, 0, 0, 0.5);
  justify-content: center;
  align-items: center;
  padding: 20px;
`;

export const ModalContainer = styled.View`
  background-color: ${({ theme }) => theme.COLORS.BACKGROUND};
  border-radius: 12px;
  width: 100%;
  max-width: 400px;
`;

export const ModalHeader = styled.View`
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom-width: 1px;
  border-bottom-color: ${({ theme }) => theme.COLORS.BACKGROUND_500};
`;

export const ModalTitle = styled.Text`
  font-size: 18px;
  font-weight: 700;
  color: ${({ theme }) => theme.COLORS.TEXT_PRIMARY};
  flex: 1;
`;

export const CloseIcon = styled.View`
  padding: 4px;
`;

export const ModalContent = styled.View`
  padding: 20px;
`;

export const ConfigSection = styled.View`
  margin-bottom: 16px;
`;

export const ConfigLabel = styled.View`
  margin-bottom: 8px;
`;

export const ConfigInput = styled.View`
  flex-direction: row;
  align-items: center;
  border-width: 1px;
  border-color: ${({ theme }) => theme.COLORS.BACKGROUND_500};
  border-radius: 8px;
  padding: 0px 12px;
  background-color: ${({ theme }) => theme.COLORS.BACKGROUND};
  min-height: 48px;
`;

export const ButtonRow = styled.View`
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
`;

export const CancelButton = styled.TouchableOpacity`
  flex: 1;
  align-items: center;
  justify-content: center;
  padding: 12px 24px;
  border-radius: 6px;
  border-width: 1px;
  border-color: ${({ theme }) => theme.COLORS.BACKGROUND_500};
  margin-right: 8px;
`;

export const SaveButton = styled.TouchableOpacity`
  padding: 12px 24px;
  border-radius: 6px;
  background-color: ${({ theme }) => theme.COLORS.PRIMARY};
  flex: 1;
  margin-left: 8px;
  align-items: center;
`;

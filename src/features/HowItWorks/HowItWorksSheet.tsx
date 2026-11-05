import React from 'react';
import { Platform } from 'react-native';

import {
  BottomSheet,
  Button,
  IconTile,
  List,
  ListRow,
  type IconName,
} from '@components/ui';

export type HowItWorksItem = { icon: IconName; text: string };

/**
 * Enquanto o app confirma que é um aluno da UERJ (a tela já diz isso no
 * título): só o que o aluno precisa saber para esperar ou desistir. No
 * Android, a confirmação passa pela Play Store; no iPhone, pela Apple, só
 * com a internet. Lido a cada desenho (os testes trocam a plataforma).
 */
export function proofWaitText(): string {
  return Platform.OS === 'ios'
    ? 'Leva alguns segundos. Sem internet, não dá para confirmar.'
    : 'Leva alguns segundos. Sem a Play Store no celular, não dá para confirmar.';
}

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Uma frase por linha, curta: quem entra, o que os outros veem, a moderação. */
  items: readonly HowItWorksItem[];
};

/**
 * O detalhe que sai do rodapé das telas abertas aos alunos (Companhia agora,
 * Agora no campus): a tela diz só o essencial numa frase, e "Como funciona"
 * abre isto. Nunca abre sozinha.
 */
export function HowItWorksSheet({ visible, onClose, items }: Props) {
  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Como funciona"
      footer={<Button label="Entendi" onPress={onClose} />}
    >
      <List>
        {items.map(item => (
          <ListRow
            key={item.text}
            dense
            leading={<IconTile icon={item.icon} />}
            title={item.text}
            titleWeight="regular"
          />
        ))}
      </List>
    </BottomSheet>
  );
}

import React, { useCallback } from 'react';
import { Linking } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { DrawerNavigationProp } from '@react-navigation/drawer';

import { RootDrawerParamList } from '@root/routes';
import { isPortalBlocked } from '@root/modules/academics/presentation/queries';
import { Prereq, SubjectInfo } from '@root/modules/academics/domain/models';
import { useBackHandler } from '@hooks/useBackHandler';
import { useHeaderBack } from '@templates/Header';
import {
  BlockedState,
  Button,
  ErrorState,
  ListRow,
  Section,
  SkeletonList,
  StatusLabel,
  Text,
} from '@components/ui';

import ClassesTable from '../ClassesTable';
import {
  isCreditLock,
  plural,
  requirementMet,
  syllabusUrl,
} from '../subjectFormat';
import { useCachedHistory } from '../useCachedHistory';
import {
  GroupLabel,
  GroupList,
  Properties,
  RequirementMeta,
  SyllabusFoot,
} from './SubjectView.styles';

type Props = {
  searchSubject: (s: string | number) => void;
  code: string | number;
  subject?: SubjectInfo;
  loading: boolean;
  error?: unknown;
  sourceRoute?: keyof RootDrawerParamList;
};

const ERROR_TEXT =
  'Ops, ocorreu um erro ao buscar as informações da disciplina. Toque aqui para tentar novamente.';

function Requirement({
  item,
  approval,
  onOpen,
  divider,
}: {
  item: Prereq;
  approval: string | null;
  onOpen: (id: string) => void;
  /** Repassado pelo `List`, que tira o fio do último item. */
  divider?: boolean;
}) {
  const lock = isCreditLock(item.id);
  return (
    <ListRow
      dense
      divider={divider}
      title={item.name}
      meta={
        <RequirementMeta>
          {lock ? (
            <StatusLabel tone="warn" icon="lock" label={item.id} />
          ) : (
            <Text variant="meta" tone="muted">
              {item.id}
            </Text>
          )}
          {approval ? (
            <StatusLabel tone="good" icon="check" label={approval} />
          ) : null}
        </RequirementMeta>
      }
      chevron={!lock}
      onPress={lock ? undefined : () => onOpen(item.id)}
      accessibilityLabel={[item.name, item.id, approval]
        .filter(Boolean)
        .join(', ')}
    />
  );
}

const SubjectView = ({
  searchSubject,
  subject,
  loading,
  code,
  error,
  sourceRoute,
}: Props) => {
  const navigation =
    useNavigation<
      DrawerNavigationProp<RootDrawerParamList, 'Pesquisa de Disciplinas'>
    >();
  const history = useCachedHistory();

  const handleBack = useCallback(() => {
    navigation.setParams({ subjectId: undefined, sourceRoute: undefined });
    if (sourceRoute) navigation.navigate(sourceRoute as never);
  }, [sourceRoute, navigation]);
  useBackHandler(handleBack);
  useHeaderBack(handleBack);

  const isBlocked = isPortalBlocked(error);

  const hasData = Boolean(subject && code);
  const getSubject = (subjectCode: string | number) => {
    if (isCreditLock(subjectCode)) {
      return;
    }

    const sameCode = code === subjectCode || subjectCode === subject?.id;
    if (hasData && sameCode && !error) {
      return;
    }
    searchSubject(subjectCode);
  };

  const handleSyllabusPress = () => {
    Linking.openURL(syllabusUrl(code)).catch((err: Error) =>
      console.log('err', err),
    );
  };

  const syllabus = (afterState = false) => (
    <SyllabusFoot $afterState={afterState}>
      <Button
        variant="outline"
        block
        icon="open_in_new"
        label="Acessar ementa"
        accessibilityHint="Abre o ementário da UERJ no navegador"
        onPress={handleSyllabusPress}
      />
    </SyllabusFoot>
  );

  if (!subject) {
    if (error && !loading) {
      return (
        <>
          {isBlocked ? (
            <BlockedState onRetry={() => getSubject(code)} />
          ) : (
            <ErrorState message={ERROR_TEXT} onRetry={() => getSubject(code)} />
          )}
          {syllabus(true)}
        </>
      );
    }
    return (
      <>
        <Text variant="meta" tone="muted">
          {`Buscando disciplina ${code}`}
        </Text>
        <SkeletonList count={4} />
      </>
    );
  }

  const id = subject.id ?? String(code);
  const prerequisite = (subject.prerequisite ?? []).filter(
    group => group.length > 0,
  );
  const classes = subject.classes ?? [];

  return (
    <>
      <Text variant="titleL" accessibilityRole="header">
        {subject.name || `Disciplina ${id}`}
      </Text>
      <Properties
        items={[
          { label: 'Código', value: id },
          {
            label: 'Créditos',
            value: subject.credits != null ? String(subject.credits) : '–',
          },
          {
            label: 'Carga horária',
            value: subject.workload != null ? `${subject.workload} horas` : '–',
          },
          { label: 'Duração', value: subject.duration || '–' },
        ]}
      />

      <Section title="Requisitos exigidos">
        {prerequisite.length ? (
          prerequisite.map((group, index) => (
            <React.Fragment key={index}>
              <GroupLabel label={`Grupo ${index + 1}`} />
              <GroupList>
                {group.map(item => (
                  <Requirement
                    key={`${index}:${item.id}`}
                    item={item}
                    approval={requirementMet(item.id, history)}
                    onOpen={getSubject}
                  />
                ))}
              </GroupList>
            </React.Fragment>
          ))
        ) : (
          <Text variant="meta" tone="muted">
            Nenhum requisito exigido
          </Text>
        )}
      </Section>

      <Section
        title="Turmas"
        note={
          classes.length ? plural(classes.length, 'turma', 'turmas') : undefined
        }
      >
        {classes.length ? (
          <ClassesTable classes={classes} />
        ) : (
          <Text variant="meta" tone="muted">
            Nenhuma turma disponível
          </Text>
        )}
      </Section>

      {syllabus()}
    </>
  );
};

export default SubjectView;

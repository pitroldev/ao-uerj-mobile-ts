import axios from 'axios';
import React, {useState} from 'react';
import {Picker} from '@react-native-picker/picker';
import FontAwesome from 'react-native-vector-icons/FontAwesome';

import {refreshAuth} from '@services/UerjApi';
import {parseSubjectCode} from '@services/parser/minorParser';
import {
  parseClassToGeneratorFormat,
  parseSubjectToGeneratorFormat,
} from '@utils/converter';

import {fetchSubjectsTaken} from '@features/SubjectsTaken/core';
import {getSubjectInfo} from '@features/SubjectInfo/core';
import {getSubjectClassesSchedule} from '@features/SubjectClassesSchedule/core';
import {fetchSubjectsToTake} from '@features/SubjectsToTake/core';

import Text from '@atoms/Text';
import StyledButton from '@atoms/Button';
import StyledPicker from '@atoms/Picker';
import TextInputWithIcon from '@atoms/TextInput';
import SubjectBox from '@molecules/SubjectBox';
import {MainContainer as ScrollView} from './Home/Home.styles';
import {retry} from '@root/services/UerjApi/utils';

const Playground = () => {
  const [loading, setLoading] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState('');

  const extractData = async () => {
    try {
      setLoading(true);
      console.log('Extraindo dados...');
      const subjects: any[] = [];
      const classes: any[] = [];

      console.log('Extraindo a cursar');
      const data = await retry(() => fetchSubjectsToTake());

      console.log('Extraindo disciplinas cursadas');
      const attendedSubjects = await retry(() => fetchSubjectsTaken());
      let counter = 0;

      for await (const s of data) {
        console.log('Calling INFO:', s.id);
        const info = await retry(() => getSubjectInfo(parseSubjectCode(s.id)));
        console.log('Calling Classes:', s.id);
        const subject = parseSubjectToGeneratorFormat(s, info);
        subjects.push(subject);

        const class_ = await retry(() =>
          getSubjectClassesSchedule(parseSubjectCode(s.id)),
        );

        const parsedClasse = class_.map(c =>
          parseClassToGeneratorFormat(c, info),
        );

        classes.push(parsedClasse);
        counter++;
        const percent = (counter / data.length) * 100;
        console.log(`>> ${Math.round(percent)}% Success:`, s.id);
      }
      const res = await axios.post('http://192.168.1.11:3001/save', {
        subjects,
        attendedSubjects,
        classes,
      });
      console.log(res.data);
    } catch (err) {
      console.log('erro:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView>
      <Text size="XXL" weight="900" margin="10px" alignSelf="center">
        Porra, foda !
      </Text>
      <TextInputWithIcon
        value={selectedLanguage}
        onChangeText={setSelectedLanguage}
        placeholder="Selecione o idioma"
        icon={<FontAwesome name="search" size={15} />}
      />
      <StyledPicker
        loading={loading}
        selectedValue={selectedLanguage}
        placeholder="Selecione o idioma"
        onValueChange={(s: any) => setSelectedLanguage(s)}>
        {'Português,Inglês,Espanhol'.split(',').map(lang => (
          <Picker.Item key={lang} label={lang} value={lang} />
        ))}
      </StyledPicker>
      <SubjectBox
        topLeftInfo="CODE-321"
        topRightInfo="Informação Esquerda"
        name="Título Grande do Subject Box III"
        description="Descrição"
        bottomLeftInfo="Informação Esquerda"
        bottomRightInfo="Informação Direita"
        boldOptions={{
          topLeft: true,
          name: true,
        }}
      />
      <StyledButton onPress={() => refreshAuth()}>Login</StyledButton>
      <StyledButton loading>Loading</StyledButton>
      <StyledButton disabled>Desabilitado</StyledButton>
      <StyledButton
        variant="SECONDARY"
        size="small"
        onPress={async () => {
          await extractData();
        }}>
        Extrair dados
      </StyledButton>
      <StyledButton variant="SECONDARY" size="small" loading>
        Loading
      </StyledButton>
      <StyledButton variant="SECONDARY" size="small" disabled>
        Desabilitado
      </StyledButton>
    </ScrollView>
  );
};

export default Playground;

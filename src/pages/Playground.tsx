import axios from 'axios';
import React, {useState} from 'react';
import {Picker} from '@react-native-picker/picker';
import FontAwesome from 'react-native-vector-icons/FontAwesome';

import StyledButton from '@atoms/Button';
import StyledPicker from '@atoms/Picker';
import TextInputWithIcon from '@atoms/TextInput';
import SubjectBox from '@molecules/SubjectBox';
import {parseCodigo} from '../services/parser/minorParser';
import {
  parseClassToGeneratorFormat,
  parseSubjectToGeneratorFormat,
} from '../utils/converter';
import Text from '../components/atoms/Text';
import {MainContainer as ScrollView} from './Home/Home.styles';
import {
  getAttendedSubjects,
  getSubjectClassesSchedule,
  getSubjectInfo,
  getSubjectsToTake,
} from '../services/UerjApi';

const Playground = () => {
  const [loading, setLoading] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState('');

  const extractData = async () => {
    setLoading(true);
    const subjects: any[] = [];
    const classes: any[] = [];
    const data = await getSubjectsToTake();
    const attendedSubjects = await getAttendedSubjects();
    let counter = 0;

    for await (const s of data) {
      console.log('Calling INFO:', s.id);
      const info = await getSubjectInfo(parseCodigo(s.id)).catch(
        async () => await getSubjectInfo(parseCodigo(s.id)),
      );

      console.log('Calling Classes:', s.id);
      const subject = parseSubjectToGeneratorFormat(s, info);
      subjects.push(subject);

      const class_ = await getSubjectClassesSchedule(parseCodigo(s.id)).catch(
        async () => await getSubjectClassesSchedule(parseCodigo(s.id)),
      );

      const parsedClasse = class_.map(c =>
        parseClassToGeneratorFormat(c, info),
      );

      classes.push(parsedClasse);
      counter++;
      const percent = (counter / data.length) * 100;
      console.log(`>> ${Math.round(percent)}% Success:`, s.id);
    }
    const res = await axios.post('http://192.168.1.7:3001/save', {
      subjects,
      attendedSubjects,
      classes,
    });
    setLoading(false);
    console.log(res.data);
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
      <StyledButton>Login</StyledButton>
      <StyledButton loading>Loading</StyledButton>
      <StyledButton disabled>Desabilitado</StyledButton>
      <StyledButton
        variant="secondary"
        size="small"
        onPress={async () => {
          await extractData();
        }}>
        Extrair dados
      </StyledButton>
      <StyledButton variant="secondary" size="small" loading>
        Loading
      </StyledButton>
      <StyledButton variant="secondary" size="small" disabled>
        Desabilitado
      </StyledButton>
    </ScrollView>
  );
};

export default Playground;

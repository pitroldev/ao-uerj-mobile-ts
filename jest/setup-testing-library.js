// Testing Library (@testing-library/react-native): os matchers e a limpeza
// depois de cada teste já entram ao importar o pacote. Aqui só ligamos o aviso
// de evento que não chegou a nenhum handler (elemento desabilitado, bloqueado
// por pointerEvents ou sem onX), que denuncia um press que não fez nada.
const { configure } = require('@testing-library/react-native');

configure({ eventDiagnostics: true });

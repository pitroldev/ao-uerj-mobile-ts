import './src/app/observability/register';
import { AppRegistry } from 'react-native';
import { App } from './src';
import { registerBackgroundTasks } from './src/app/background';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);
registerBackgroundTasks();

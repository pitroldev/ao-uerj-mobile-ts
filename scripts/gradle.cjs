const path = require('node:path');
const { spawnSync } = require('node:child_process');

function gradleCommand(args, platform = process.platform) {
  if (!args.length || args.some(arg => !/^[\w.=:/,\\+-]+$/.test(arg))) {
    throw new Error(
      'Informe tarefas e opções do Gradle sem metacaracteres de shell.',
    );
  }
  if (platform === 'win32') {
    return {
      command: process.env.ComSpec || 'cmd.exe',
      args: ['/d', '/s', '/c', `gradlew.bat ${args.join(' ')}`],
    };
  }
  return { command: 'sh', args: ['./gradlew', ...args] };
}

function runGradle(args) {
  const invocation = gradleCommand(args);
  const result = spawnSync(invocation.command, invocation.args, {
    cwd: path.resolve(__dirname, '../android'),
    stdio: 'inherit',
    shell: false,
    windowsHide: true,
  });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

if (require.main === module) {
  try {
    process.exitCode = runGradle(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { gradleCommand, runGradle };

import { sendClientConsoleLogs, getWsPort } from './dev-server';
import LOGGER_DIR from '../serve';


function getConsoleLoggerScript() {
  const ionDevServer = JSON.stringify({
    sendConsoleLogs: sendClientConsoleLogs(),
    wsPort: getWsPort()
  });

  return `
  ${LOGGER_HEADER}
  <script>var IonicDevServerConfig=${ionDevServer};</script>
  <link href="${LOGGER_DIR}/ion-dev.css" rel="stylesheet">
  <script src="${LOGGER_DIR}/ion-dev.js"></script>
  `;
}

export function injectDevLoggerScript(content: any): any {
  let contentStr = content.toString();

  if (contentStr.indexOf(LOGGER_HEADER) > -1) {
    // already added script somehow
    return content;
  }

  let match = contentStr.match(/<head>(?![\s\S]*<head>)/i);
  if (!match) {
    match = contentStr.match(/<body>(?![\s\S]*<body>)/i);
  }
  if (match) {
    contentStr = contentStr.replace(match[0], `${match[0]}\n${getConsoleLoggerScript()}`);
  } else {
    contentStr = getConsoleLoggerScript() + contentStr;
  }

  return contentStr;
}

export function useDevLogger() {
  return true;
}


const LOGGER_HEADER = '<!-- Ionic Dev Server: Injected Logger Script -->';

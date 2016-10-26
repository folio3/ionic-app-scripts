import { BuildContext } from './util/interfaces';
import { generateContext, getConfigValueDefault, hasConfigValue } from './util/config';
import { Logger } from './util/logger';
import { watch } from './watch';
import * as chalk from 'chalk';
import open from './util/open';
import { createNotificationServer } from './dev-server/notification-server';
import { createHttpServer } from './dev-server/http-server';
import { createLiveReloadServer } from './dev-server/live-reload';
import { ServeConfig, IONIC_LAB_URL } from './dev-server/serve-config';


const DEV_LOGGER_DEFAULT_PORT = 53703;
const LIVE_RELOAD_DEFAULT_PORT = 35729;
const DEV_SERVER_DEFAULT_PORT = 8100;
const DEV_SERVER_DEFAULT_HOST = 'localhost';

export function serve(context?: BuildContext) {
  context = generateContext(context);

  const config: ServeConfig = {
    httpPort: getHttpServerPort(),
    host: getHttpServerHost(),
    rootDir: context.wwwDir,
    launchBrowser: launchBrowser(),
    launchLab: launchLab(),
    browserToLaunch: browserToLaunch(),
    useLiveReload: useLiveReload(),
    liveReloadPort: getLiveReloadServerPort(),
    notificationPort: getNotificationPort(),
    useServerLogs: useServerLogs(),
    useNotifier: true,
    useProxy: useProxy(),
    notifyOnConsoleLog: sendClientConsoleLogs()
  };

  const HttpServer = createHttpServer(config);
  const liveReloadServer = createLiveReloadServer(config);
  const notificationServer = createNotificationServer(config);

  return watch(context)
    .then(() => {
      onReady(config);
    }, () => {
      onReady(config);
    });
}

function onReady(config: ServeConfig) {
  if (config.launchBrowser || config.launchLab) {
    const openOptions: string[] = [`http://${config.host}:${config.httpPort}/`]
      .concat(launchLab() ? [IONIC_LAB_URL] : [])
      .concat(browserOption() ? [browserOption()] : [])
      .concat(platformOption() ? ['?ionicplatform=', platformOption()] : []);

    open(openOptions.join(''), browserToLaunch());
  }
  Logger.info(chalk.green(`dev server running: http://${config.host}:${config.httpPort}/`));
}

function getHttpServerPort() {
  const port = getConfigValueDefault('--port', '-p', 'ionic_port', null);
  if (port) {
    return parseInt(port, 10);
  }
  return DEV_SERVER_DEFAULT_PORT;
}

function getHttpServerHost() {
  const host = getConfigValueDefault('--address', '-h', 'ionic_address', null);
  if (host) {
    return host;
  }
  return DEV_SERVER_DEFAULT_HOST;
}

function getLiveReloadServerPort() {
  const port = getConfigValueDefault('--livereload-port', null, 'ionic_livereload_port', null);
  if (port) {
    return parseInt(port, 10);
  }
  return LIVE_RELOAD_DEFAULT_PORT;
}

export function getNotificationPort() {
  const port = getConfigValueDefault('--dev-logger-port', null, 'ionic_dev_logger_port', null);
  if (port) {
    return parseInt(port, 10);
  }
  return DEV_LOGGER_DEFAULT_PORT;
}

function useServerLogs() {
  return hasConfigValue('--serverlogs', '-s', 'ionic_serverlogs', false);
}

function launchBrowser() {
  return !hasConfigValue('--nobrowser', '-b', 'ionic_launch_browser', false);
}

function browserToLaunch() {
  return getConfigValueDefault('--browser', '-w', 'ionic_browser', null);
}

function browserOption() {
  return getConfigValueDefault('--browseroption', '-o', 'ionic_browseroption', null);
}

function launchLab() {
  return hasConfigValue('--lab', '-l', 'ionic_lab', false);
}

function platformOption() {
  return getConfigValueDefault('--platform', '-t', 'ionic_platform_browser', null);
}

function useLiveReload() {
  return !hasConfigValue('--nolivereload', '-d', 'ionic_livereload', false);
}

function useProxy() {
  return !hasConfigValue('--noproxy', '-x', 'ionic_proxy', false);
}

function sendClientConsoleLogs() {
  return hasConfigValue('--consolelogs', '-c', 'ionic_consolelogs', false);
}

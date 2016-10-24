import { BuildContext } from './util/interfaces';
import { generateContext, getConfigValueDefault, hasConfigValue } from './util/config';
import { Logger } from './util/logger';
import { watch } from './watch';
import * as path from 'path';
import * as chalk from 'chalk';
import * as devLogger from './dev-server/injector';
import * as liveReload from './dev-server/live-reload';
import * as devServer from './dev-server/dev-server';
import * as mime from 'mime-types';
import * as fs from 'fs';
import { promisify } from '../util/promisify';
import { HttpServerConfig, HttpServer, serveStatic, Request, Response } from './dev-server/http-server';
import * as open from 'open';

const DEV_SERVER_DEFAULT_PORT = 8100;
export const IONIC_LAB_URL = '/__ion-dev-server/ionic_lab.html';
export const LOGGER_DIR = '__ion-dev-server';

export function serve(context?: BuildContext) {
  context = generateContext(context);

  const server = createDevServer({
    port: getHttpServerPort(),
    host: getHttpServerHost(),
    rootDir: context.wwwDir
  });

  Logger.info(chalk.green(`dev server running: http://${server.config.host}:${server.config.port}/`));

  if (launchBrowser() || launchLab()) {
    const openOptions: string[] = [`http://${server.config.host}:${server.config.port}/`]
      .concat(launchLab() ? [IONIC_LAB_URL] : [])
      .concat(browserOption() ? [browserOption()] : [])
      .concat(platformOption() ? ['?ionicplatform=', platformOption()] : []);

    open(openOptions.join(''), browserToLaunch());
  }

  return watch(context)
    .then(() => {
      serverReady();
    }, () => {
      serverReady();
    });
}

/**
 * Create HTTP server
 */
export function createDevServer(config: HttpServerConfig) {
  const server = new HttpServer({
    port: config.port,
    host: config.host,
    rootDir: config.rootDir
  });

  server.addRoute('GET', '/', serveIndex);
  server.addRoute('GET', '/cordova.js', serveCordovaJS);
  server.addRoute('GET', `/${LOGGER_DIR}/:file`, serveAppScriptAsset);
  server.addRoute('GET', '*', serveStatic);

  return server;
}

/**
 * http responder for /index.html base entrypoint
 */
function serveIndex(req: Request, res: Response) {
  const readFilePromise = promisify<Buffer, string>(fs.readFile);

  return readFilePromise(req.filePath).then((content: Buffer) => {
    if (liveReload.useLiveReload()) {
      content = liveReload.injectLiveReloadScript(content);
    }
    if (devLogger.useDevLogger()) {
      content = devLogger.injectDevLoggerScript(content);
    }

    // File found so lets send it back to the response
    res.writeHead(200, {
      'Content-Type': mime.lookup(req.filePath),
      'X-DEV-FILE-PATH': req.filePath
    });
    res.end(content);
  });
}

/**
 * http responder for static assets in app-scripts
 */
function serveAppScriptAsset(req: Request, res: Response) {
  const fileName = req.params.file;
  const filePath = path.join(__dirname, '..', '..', 'bin', fileName);
  const readFilePromise = promisify<Buffer, string>(fs.readFile);

  readFilePromise(req.filePath).then((content: Buffer) => {
    res.writeHead(200, {
      'Content-Type': mime.lookup(filePath) || 'application/octet-stream'
    });
    res.end(content);
  });
}

/**
 * http responder for cordova.js fiel
 */
function serveCordovaJS(req: Request, res: Response) {
  res.writeHead(200, {
    'Content-Type': 'application/javascript'
  });
  res.end('// mock cordova file during development');
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

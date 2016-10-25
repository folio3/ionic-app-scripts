import * as http from 'http';
import { Logger } from '../util/logger';
import * as fs from 'fs';
import * as path from 'path';
import * as url from 'url';
import * as pathToRegexp from 'path-to-regexp';
import * as mime from 'mime-types';
import { promisify } from '../util/promisify';

export interface HttpServerConfig {
  port: number;
  host: string;
  rootDir: string;
  useLiveReload?: boolean;
  useDevLogger?: boolean;
}

export const RequestMethod = {
  GET: 'GET',
  HEAD: 'HEAD',
  POST: 'POST',
  PUT: 'PUT',
  DELETE: 'DELETE',
  OPTIONS: 'OPTIONS'
}

export interface ResponseHandler {
  method: string;
  pathRegex: pathToRegexp.Path;
  callback: Function;
}

export interface Request extends http.IncomingMessage {
  relativefilePath: string;
  filePath: string;
  useLiveReload: boolean;
  useDevLogger: boolean;
  params: string[];
  queryString: string;
}
export { ServerResponse as Response } from 'http';

export class HttpServer {
  httpServer: http.Server;
  staticServer: Function;
  rootDir: string;
  responseFunctionList: ResponseHandler[] = [];

  constructor(public config: HttpServerConfig = {
    port: 8080,
    host: 'localhost',
    useLiveReload: true,
    useDevLogger: true,
    rootDir: null
  }) {
    this.httpServer = http.createServer((request: http.IncomingMessage, response: http.ServerResponse) =>
      this.handleRequest(request, response));
    this.httpServer.listen(config.port, config.host, undefined);
  }

  updateListener() {
    setTimeout(() => {
      this.httpServer.close();
      this.httpServer.listen(this.config.port, this.config.host, undefined);
    }, 1500);
  }

  handleRequest(request: http.IncomingMessage, response: http.ServerResponse) {
    let req = <Request>Object.assign({}, request);
    let routeMatch: Function;

    for (let reqResolver of this.responseFunctionList) {
      let urlParts = url.parse(req.url);
      let segments = resolvePathRegex(reqResolver, req.method, urlParts.pathname);
      if (segments) {
        req.relativefilePath = urlParts.pathname;
        req.queryString = urlParts.query;
        req.filePath = path.join(this.config.rootDir, req.relativefilePath);
        routeMatch = reqResolver.callback;
        req.params = segments.slice(1) || [];
        break;
      }
    }

    routeMatch(req, response).catch((err: any) => serveError(req, response, err));
  }

  addRoute(method: string, pathRegex: pathToRegexp.Path, callback: Function) {
    this.responseFunctionList.push({
      method,
      pathRegex,
      callback
    });
  }
}

function resolvePathRegex(resHandler: ResponseHandler, method: string, path: string) {
  const regex = pathToRegexp(resHandler.pathRegex, {});

  if (method === resHandler.method && regex.test(path)) {
    return regex.exec(path);
  }
  return null;
}

export function serveStatic(req: Request, res: http.ServerResponse): Promise<void> {
  const statFilePromise = promisify<fs.Stats, string>(fs.stat);

  return statFilePromise(req.filePath).then((fileStats): Promise<void> => {
    if (fileStats.isFile()) {
      return serveFile(req, res);
    } else if (fileStats.isDirectory()) {
      return serveDirectory(req, res);
    }
    throw new Error('unkown error occurred');
  });
}

function serveFile(req: Request, res: http.ServerResponse): Promise<void> {
  const readFilePromise = promisify<Buffer, string>(fs.readFile);

  return readFilePromise(req.filePath).then((content) => {

    // File found so lets send it back to the response
    res.writeHead(200, {
      'Content-Type': mime.lookup(req.filePath) || 'application/octet-stream',
      'X-DEV-FILE-PATH': req.filePath
    });
    res.end(content);
  });
}

function serveDirectory(req: Request, res: http.ServerResponse): Promise<void> {
  const statFilePromise = promisify<fs.Stats, string>(fs.stat);
  const htmlFile = path.join(req.filePath, 'index.html');

  return statFilePromise(htmlFile).then(() => {
    return serveFile(req, res);
  });
}

function serveError(req: Request, res: http.ServerResponse, err: any) {
  Logger.error(`http server error: ${err}`);

  // File was not found so lets fail with a 404.
  if (err.code === 'ENOENT') {
    res.writeHead(404, {
      'Content-Type': 'text/html'
    });
    return res.end(`File not found: ${req.url}<br>Local file: ${req.filePath}`);
  }

  // Some other error occurred so throw a 500 back.
  res.writeHead(500, {
    'Content-Type': 'text/html'
  });
  res.end(`Sorry, check with the site admin for error: ${err.code} ..\n`);
}

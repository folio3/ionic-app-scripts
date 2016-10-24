import * as http from 'http';
import { Logger } from '../util/logger';
import * as fs from 'fs';
import * as path from 'path';
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
}
export { ServerResponse as Response } from 'http';

export class HttpServer {
  httpServer: http.Server;
  staticServer: Function;
  rootDir: string;
  private responseFunctionList: ResponseHandler[];

  constructor(public config: HttpServerConfig = {
    port: 8080,
    host: 'localhost',
    rootDir: null,
    useLiveReload: true,
    useDevLogger: true
  }) {
    this.httpServer = http.createServer(this.handleRequest);
    this.httpServer.listen(config.port, config.host, undefined);
  }

  handleRequest(request: http.IncomingMessage, response: http.ServerResponse) {
    let req = <Request>Object.assign({}, request);
    req.relativefilePath = '.' + req.url.split('?')[0];
    req.filePath = path.join(this.rootDir, req.filePath);

    let routeMatch: Function;

    for (let reqResolver of this.responseFunctionList) {
      let segments = resolvePathRegex(reqResolver, req.method, req.relativefilePath);
      if (segments) {
        routeMatch = reqResolver.callback;
        req.params = segments.slice(1);
        break;
      }
    }

    routeMatch(req, response)
    .catch((err: any) => serveError(req, response, err));
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
  var keys = {};
  var regex = pathToRegexp(resHandler.pathRegex, keys);

  if (method === resHandler.method && regex.test(path)) {
    return regex.exec(path);
  }
  return null;
}

export function serveStatic(req: Request, res: http.ServerResponse) {
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

function serveError(req: Request, res: http.ServerResponse, err: any) {
  Logger.error(`http server error: ${err}`);

  // File was not found so lets fail with a 404.
  if (err === 'ENOENT') {
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

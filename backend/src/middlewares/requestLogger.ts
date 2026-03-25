import { Request, Response, NextFunction } from 'express';

export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const statusColor =
      res.statusCode >= 500
        ? '\x1b[31m'
        : res.statusCode >= 400
        ? '\x1b[33m'
        : res.statusCode >= 300
        ? '\x1b[36m'
        : '\x1b[32m';
    const reset = '\x1b[0m';
    console.log(
      `${statusColor}[${res.statusCode}]${reset} ${req.method} ${req.originalUrl} - ${duration}ms`
    );
  });

  next();
};

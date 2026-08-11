import { ApiKeyMiddleware } from './logger.middleware';
import { Request, Response } from 'express';
import { envs } from '../../config';

describe('ApiKeyMiddleware', () => {
  let middleware: ApiKeyMiddleware;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: jest.Mock;
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    middleware = new ApiKeyMiddleware();
    nextFunction = jest.fn();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  it('should be defined', () => {
    expect(middleware).toBeDefined();
  });

  it('should call next() if the x-api-key header is valid', () => {
    mockRequest = {
      header: jest.fn().mockReturnValue(envs.internalApiKey),
      method: 'GET',
      originalUrl: '/test',
    };

    middleware.use(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(mockRequest.header).toHaveBeenCalledWith('x-api-key');
    expect(nextFunction).toHaveBeenCalled();
    expect(mockResponse.status).not.toHaveBeenCalled();
  });

  it('should return 401 status if the x-api-key header is missing', () => {
    mockRequest = {
      header: jest.fn().mockReturnValue(undefined),
      method: 'GET',
      originalUrl: '/test',
    };

    middleware.use(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(mockRequest.header).toHaveBeenCalledWith('x-api-key');
    expect(nextFunction).not.toHaveBeenCalled();
    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(mockResponse.json).toHaveBeenCalledWith({ message: 'Falta clave API' });
  });

  it('should return 403 status if the x-api-key header is invalid', () => {
    mockRequest = {
      header: jest.fn().mockReturnValue('wrong-key-value'),
      method: 'GET',
      originalUrl: '/test',
    };

    middleware.use(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(mockRequest.header).toHaveBeenCalledWith('x-api-key');
    expect(nextFunction).not.toHaveBeenCalled();
    expect(mockResponse.status).toHaveBeenCalledWith(403);
    expect(mockResponse.json).toHaveBeenCalledWith({ message: 'Clave API invalida' });
  });
});

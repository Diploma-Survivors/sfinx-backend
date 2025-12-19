import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';

import { Judge0Config } from 'src/config';
import { JUDGE0_HEADERS } from './constants';

/**
 * HTTP client for Judge0 API communication.
 * Handles all HTTP requests, header building, and error handling.
 */
@Injectable()
export class Judge0HttpClient {
  private readonly logger = new Logger(Judge0HttpClient.name);
  private readonly baseUrl: string;
  private readonly judge0Config: Judge0Config;

  constructor(private readonly configService: ConfigService) {
    this.judge0Config = this.configService.getOrThrow<Judge0Config>('judge0');
    this.baseUrl = this.buildBaseUrl();
  }

  /**
   * Builds the base URL for Judge0 API based on configuration
   */
  private buildBaseUrl(): string {
    if (this.judge0Config.judge0UseCe) {
      return `https://${this.judge0Config.apiRapidHost}`;
    }
    return this.judge0Config.judge0Url;
  }

  /**
   * Builds HTTP headers for Judge0 API requests.
   * Includes RapidAPI headers if using CE version.
   */
  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      [JUDGE0_HEADERS.CONTENT_TYPE]: JUDGE0_HEADERS.APPLICATION_JSON,
    };

    if (this.judge0Config.judge0UseCe) {
      headers[JUDGE0_HEADERS.RAPID_API_KEY] = this.judge0Config.apiRapidKey;
      headers[JUDGE0_HEADERS.RAPID_API_HOST] = this.judge0Config.apiRapidHost;
    }

    return headers;
  }

  /**
   * Performs a GET request to Judge0 API
   */
  async get<T>(endpoint: string, errorMessage: string): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    this.logger.log(`GET request to: ${url}`);

    const config: AxiosRequestConfig = {
      headers: this.buildHeaders(),
    };

    try {
      const response: AxiosResponse<T> = await axios.get<T>(url, config);
      return response.data;
    } catch (error) {
      this.logger.error(`${errorMessage}: ${error}`);
      throw new InternalServerErrorException(errorMessage);
    }
  }

  /**
   * Performs a POST request to Judge0 API
   */
  async post<TRequest, TResponse>(
    endpoint: string,
    data: TRequest,
    errorMessage: string,
  ): Promise<TResponse> {
    const url = `${this.baseUrl}${endpoint}`;
    this.logger.log(`POST request to: ${url}`);

    const config: AxiosRequestConfig = {
      headers: this.buildHeaders(),
    };

    try {
      const response: AxiosResponse<TResponse> = await axios.post<TResponse>(
        url,
        data,
        config,
      );
      return response.data;
    } catch (error) {
      this.logger.error(`${errorMessage}: ${error}`);
      throw new InternalServerErrorException(errorMessage);
    }
  }

  /**
   * Gets the Judge0 callback URL configuration
   */
  getCallbackBaseUrl(): string {
    return this.judge0Config.judge0CallbackUrl;
  }

  /**
   * Gets the API version from configuration
   */
  getApiVersion(): string {
    return this.configService.getOrThrow<string>('app.version');
  }
}

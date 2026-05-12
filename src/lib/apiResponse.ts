/**
 * Standard API response envelope builder.
 *
 * All API endpoints use this wrapper so consumers always receive a consistent
 * shape regardless of success or failure. See specs/api/API_LAYER_SPEC.md.
 */

import { v4 as uuidv4 } from 'uuid';

export interface ApiMeta {
  readonly request_id: string;
  readonly bank_id: string;
  readonly api_version: string;
  readonly timestamp: string;
  readonly processing_ms?: number;
  readonly cached_response?: boolean;
}

export interface ApiError {
  readonly code: string;
  readonly message: string;
  readonly details?: unknown;
  readonly regulatory_reference?: string;
}

export interface ApiResponse<T> {
  readonly success: boolean;
  readonly data: T | null;
  readonly error: ApiError | null;
  readonly meta: ApiMeta;
}

export function buildSuccess<T>(
  data: T,
  bankId: string,
  requestId: string = uuidv4(),
  processingMs?: number,
): ApiResponse<T> {
  return {
    success: true,
    data,
    error: null,
    meta: {
      request_id: requestId,
      bank_id: bankId,
      api_version: 'v1',
      timestamp: new Date().toISOString(),
      ...(processingMs !== undefined ? { processing_ms: processingMs } : {}),
    },
  };
}

export function buildError(
  code: string,
  message: string,
  bankId: string,
  requestId: string = uuidv4(),
  details?: unknown,
  regulatoryReference?: string,
): ApiResponse<null> {
  return {
    success: false,
    data: null,
    error: {
      code,
      message,
      ...(details !== undefined ? { details } : {}),
      ...(regulatoryReference !== undefined ? { regulatory_reference: regulatoryReference } : {}),
    },
    meta: {
      request_id: requestId,
      bank_id: bankId,
      api_version: 'v1',
      timestamp: new Date().toISOString(),
    },
  };
}

import { ErrorCodes } from './ErrorCodes.js';

export class AppError extends Error {
    constructor(code = ErrorCodes.APP_ERR_UNEXPECTED_STATE, message = 'Application error', options = {}) {
        super(message || 'Application error');
        this.name = 'AppError';
        this.code = code || ErrorCodes.APP_ERR_UNEXPECTED_STATE;
        this.traceId = options.traceId || '';
        this.details = options.details || null;
        if (options.cause) {
            this.cause = options.cause;
        }
    }
}

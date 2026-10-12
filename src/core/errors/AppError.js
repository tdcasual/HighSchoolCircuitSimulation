import { ErrorCodes } from './ErrorCodes.js';

export class AppError extends Error {
    constructor(code = ErrorCodes.APP_ERR_UNEXPECTED_STATE, message = 'Application error', options = {}) {
        super(message || 'Application error');
        this.name = 'AppError';
        this.code = code || ErrorCodes.APP_ERR_UNEXPECTED_STATE;
        this.traceId = options.traceId || '';
        this.details = options.details || null;
        this.severity = options.severity || 'error';
        this.hints = Array.isArray(options.hints) ? options.hints : [];
        this.context = options.context || null;
        if (options.cause) {
            this.cause = options.cause;
        }
    }
}

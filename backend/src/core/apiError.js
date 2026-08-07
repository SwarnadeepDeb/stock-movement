class ApiError extends Error {
    constructor(error, statusCode = 500, code = 'INTERNAL_ERROR', isOperational = true) {
        // determine the message
        const message = typeof error === "string" ? error : error.message;
        super(message);

        // assign http status code and corresponding status string
        this.statusCode = statusCode;
        this.status = `${statusCode}`.startsWith("4") ? "fail" : "error";

        // operational flag: indicates whether this is an expected error
        this.isOperational = isOperational;

        this.code = code;

        // if error is an actual Error object, preserve original error and stack
        if (error instanceof Error) {
            console.error("src :: core :: apiError :: error: ", error);
            this.originalError = error;
            this.stack = error.stack;
        } else {
            Error.captureStackTrace(this, this.constructor);
        }
    }
}

export default ApiError;

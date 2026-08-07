export class ApiResponse {
    constructor(statusCode, data, message = 'Success', meta = undefined) {
        if (!Number.isInteger(statusCode) || statusCode < 100 || statusCode > 599) {
            throw new Error(`Invalid HTTP status code: ${statusCode}`);
        }

        this.statusCode = statusCode;
        this.data = data ?? null;
        this.message = message;
        this.success = statusCode < 400;

        if (meta !== undefined) {
            this.meta = meta;
        }
    }
}

/**
 * The details of a problem, as a server describes it in an application/problem+json answer (RFC 9457): the members
 * the RFC defines, and the extension members of the server as they are.
 */
export interface OgcOpenApiProblem {
    type?: string;
    title?: string;
    status?: number;
    detail?: string;
    instance?: string;
    [member: string]: unknown;
}

export interface OgcOpenApiErrorDetails {
    status?: number;
    url?: string;
    problem?: OgcOpenApiProblem;
}

const PROBLEM_MEDIA_TYPE = "application/problem+json";

/**
 * What the library rejects with when a request fails or its answer cannot be used. status is the HTTP status when the
 * server answered with one the library does not accept, such as 401 or 403, and problem the details the server gave
 * in application/problem+json. A request that fails without an answer, a network error or an AbortError, rejects
 * with the error of fetch instead. error is always true, as in the {error, message} objects of earlier versions.
 */
export class OgcOpenApiError extends Error {
    readonly error = true;
    readonly status?: number;
    readonly url?: string;
    readonly problem?: OgcOpenApiProblem;

    constructor(message: string, details?: OgcOpenApiErrorDetails) {
        super(message);
        this.name = "OgcOpenApiError";
        if (details) {
            if (typeof details.status === "number") this.status = details.status;
            if (typeof details.url === "string") this.url = details.url;
            if (details.problem) this.problem = details.problem;
        }
    }

    /**
     * The error for an answer the library does not accept: its status, and the problem details of an
     * application/problem+json body. A body that cannot be read leaves problem out, it never hides the status.
     */
    static async fromResponse(response: Response, message: string, url: string): Promise<OgcOpenApiError> {
        return new OgcOpenApiError(message, {status: response.status, url, problem: await OgcOpenApiError.readProblem(response)});
    }

    private static async readProblem(response: Response): Promise<OgcOpenApiProblem | undefined> {
        const contentType = response.headers ? response.headers.get("Content-Type") : null;
        if (!contentType || contentType.split(";")[0].trim().toLowerCase() !== PROBLEM_MEDIA_TYPE) return undefined;
        try {
            const body = await response.json();
            return body && typeof body === "object" && !Array.isArray(body) ? body : undefined;
        } catch (e) {
            return undefined;
        }
    }
}

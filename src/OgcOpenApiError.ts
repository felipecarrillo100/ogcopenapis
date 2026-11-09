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
    body?: string;
}

const PROBLEM_MEDIA_TYPE = "application/problem+json";

// The longest body kept in an error, servers can answer a whole HTML page
const MAX_BODY_LENGTH = 4096;

/**
 * What the library rejects with when a request fails or its answer cannot be used. status is the HTTP status when the
 * server answered with one the library does not accept, such as 401 or 403, and problem the details the server gave
 * in application/problem+json. Any other body of that answer is in body, as text (JSON, HTML or plain text, as the
 * server sent it), cut to its first 4096 characters. A request that fails without an answer, a network error or an
 * AbortError, rejects with the error of fetch instead. error is always true, as in the {error, message} objects of
 * earlier versions.
 */
export class OgcOpenApiError extends Error {
    readonly error = true;
    readonly status?: number;
    readonly url?: string;
    readonly problem?: OgcOpenApiProblem;
    readonly body?: string;

    constructor(message: string, details?: OgcOpenApiErrorDetails) {
        super(message);
        this.name = "OgcOpenApiError";
        if (details) {
            if (typeof details.status === "number") this.status = details.status;
            if (typeof details.url === "string") this.url = details.url;
            if (details.problem) this.problem = details.problem;
            if (typeof details.body === "string" && details.body !== "") this.body = details.body;
        }
    }

    /**
     * The error for an answer the library does not accept: its status, and the problem details of an
     * application/problem+json body, or else the body as text. A body that cannot be read is left out, it never
     * hides the status.
     */
    static async fromResponse(response: Response, message: string, url: string): Promise<OgcOpenApiError> {
        return new OgcOpenApiError(message, {status: response.status, url, ...await OgcOpenApiError.readBody(response)});
    }

    private static async readBody(response: Response): Promise<{ problem?: OgcOpenApiProblem, body?: string }> {
        const contentType = response.headers ? response.headers.get("Content-Type") : null;
        const isProblem = !!contentType && contentType.split(";")[0].trim().toLowerCase() === PROBLEM_MEDIA_TYPE;
        let text: string;
        try {
            text = typeof response.text === "function" ? await response.text() : "";
        } catch (e) {
            return {};
        }
        if (isProblem) {
            try {
                const body = JSON.parse(text);
                if (body && typeof body === "object" && !Array.isArray(body)) return {problem: body};
            } catch (e) {
                // Not the JSON it announces: kept as text
            }
        }
        const body = text.trim();
        return body ? {body: body.length > MAX_BODY_LENGTH ? body.substring(0, MAX_BODY_LENGTH) : body} : {};
    }
}

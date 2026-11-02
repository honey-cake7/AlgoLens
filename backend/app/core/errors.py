"""Only these public error codes/messages may leave the analysis boundary."""

ERRORS = {
    "configuration_error": (503, "Groq configuration is missing or invalid. Check the backend credentials, model and free-tier access, or use LLM_PROVIDER=fake."),
    "rate_limit": (429, "Groq free-tier capacity has been reached. Try again later or switch to Demo Mode. No automatic retry was made."),
    "provider_timeout": (504, "Groq did not respond in time. Try again later or use Demo Mode."),
    "invalid_response": (502, "The model response could not be validated. No analysis was returned. Try again later or use Demo Mode."),
    "provider_unavailable": (503, "Groq is currently unavailable. Try again later or use Demo Mode."),
    "internal_error": (500, "Analysis could not be completed because of an internal error."),
}


class AnalysisError(Exception):
    def __init__(self, code: str):
        self.code = code if code in ERRORS else "internal_error"
        self.status_code, self.message = ERRORS[self.code]
        super().__init__(self.message)

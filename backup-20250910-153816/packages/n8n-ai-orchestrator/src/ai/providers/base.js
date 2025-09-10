export class AIProvider {
    config;
    constructor(config) {
        this.config = config;
    }
    /**
     * Parse LLM response and extract OperationBatch
     */
    parseOperationBatch(content) {
        try {
            // Try to extract JSON from the response
            const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
            const jsonStr = jsonMatch ? jsonMatch[1] : content;
            // Clean up common LLM artifacts
            const cleaned = jsonStr
                .replace(/^[^{]*/, '') // Remove text before JSON
                .replace(/[^}]*$/, '') // Remove text after JSON
                .trim();
            const parsed = JSON.parse(cleaned);
            // Ensure it has the expected structure
            if (!parsed.ops || !Array.isArray(parsed.ops)) {
                return null;
            }
            return parsed;
        }
        catch (error) {
            console.error('Failed to parse OperationBatch:', error);
            return null;
        }
    }
    /**
     * Format error for better LLM understanding
     */
    formatError(error) {
        if (typeof error === 'string')
            return error;
        if (error.code && error.message) {
            return `Error ${error.code}: ${error.message}`;
        }
        if (error.message)
            return error.message;
        return JSON.stringify(error);
    }
}

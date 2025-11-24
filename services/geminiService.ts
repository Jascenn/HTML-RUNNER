import { GoogleGenAI } from "@google/genai";

const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key not found");
  }
  return new GoogleGenAI({ apiKey });
};

const withRetry = async <T>(fn: () => Promise<T>, retries = 3, baseDelay = 1000): Promise<T> => {
  let lastError: any;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      console.warn(`API Attempt ${i + 1} failed:`, error);
      
      // Retry on 5xx errors (server errors) or network-like errors
      const isServerOrNetworkError = 
        error?.code === 500 || 
        error?.status === 500 || 
        error?.message?.includes('xhr') || 
        error?.message?.includes('fetch') ||
        error?.message?.includes('network');
        
      if (!isServerOrNetworkError || i === retries - 1) {
        throw error;
      }
      
      // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, baseDelay * Math.pow(2, i)));
    }
  }
  throw lastError;
};

export const generateHtmlCode = async (prompt: string): Promise<string> => {
  return withRetry(async () => {
    const ai = getAiClient();
    const fullPrompt = `
      You are an expert Frontend Developer. 
      Generate a single HTML file containing HTML, CSS (in <style>), and JS (in <script>) based on the following request: "${prompt}".
      
      Rules:
      1. Return ONLY the raw HTML code. 
      2. Do not wrap it in markdown code blocks (e.g., no \`\`\`html).
      3. Do not add explanations or conversational text.
      4. Ensure the design is modern, using internal CSS for styling.
      5. Make it responsive and visually appealing.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: fullPrompt,
    });

    let text = response.text || "";
    text = text.replace(/^```html\s*/, '').replace(/^```\s*/, '').replace(/```$/, '');
    return text.trim();
  });
};

export const refineHtmlCode = async (currentCode: string, instruction: string): Promise<string> => {
  return withRetry(async () => {
    const ai = getAiClient();
    const fullPrompt = `
      You are an expert Frontend Developer.
      I have the following HTML code:
      
      ${currentCode}
      
      Please modify it according to this instruction: "${instruction}".
      
      Rules:
      1. Return ONLY the updated raw HTML code.
      2. Do not wrap it in markdown code blocks.
      3. Maintain existing functionality unless asked to change it.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: fullPrompt,
    });

    let text = response.text || "";
    text = text.replace(/^```html\s*/, '').replace(/^```\s*/, '').replace(/```$/, '');
    return text.trim();
  });
};

export const auditCode = async (code: string): Promise<string> => {
  return withRetry(async () => {
    const ai = getAiClient();
    const fullPrompt = `
      You are a strict Code Quality Linter (ESLint/Stylelint equivalent).
      Analyze the following HTML/CSS/JS code:
      
      ${code}
      
      Output a concise list of potential errors, warnings, or best practice violations.
      Format the output as a simple unordered list in HTML format (<ul><li>...</li></ul>) so it can be rendered directly.
      If the code is perfect, just say "No issues found."
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: fullPrompt,
    });

    return response.text || "No response from auditor.";
  });
};

export const validateHtmlCode = async (code: string): Promise<string> => {
  return withRetry(async () => {
    const ai = getAiClient();
    const fullPrompt = `
      You are a W3C HTML Validator and Standard Checker.
      Validate the following HTML code for strict compliance, accessibility (WCAG), and semantic correctness:
      
      ${code}
      
      Return a report in HTML format.
      Use a <div class="space-y-2"> structure.
      For each issue, use a styled div with color coding:
      - Critical Errors: text-red-600 font-bold
      - Warnings: text-orange-600
      - Suggestions: text-blue-600
      
      If the code is valid, return <div class="text-green-600 font-medium flex items-center gap-2">✅ Document is valid HTML5.</div>
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: fullPrompt,
    });

    return response.text || "Validation service unavailable.";
  });
};

export const explainCode = async (code: string): Promise<string> => {
  return withRetry(async () => {
    const ai = getAiClient();
    const fullPrompt = `
      You are a helpful coding instructor.
      Explain the following HTML/CSS/JS code in plain, easy-to-understand language.
      Break down the explanation into sections (Structure, Style, Interactivity).
      
      Code:
      ${code}
      
      Format the output as semantic HTML (e.g., <h3>, <p>, <ul>). 
      Keep it concise but educational.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: fullPrompt,
    });

    return response.text || "Could not explain code.";
  });
};

import { GoogleGenAI, Type } from "@google/genai";
import { DictionaryResult } from "./types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "" });

export const getWordInsights = async (text: string): Promise<DictionaryResult> => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Analyze the following word or short phrase: "${text}". Provide its concise meaning in Portuguese and at least 3 synonyms in Portuguese. Format the response as JSON.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          word: { type: Type.STRING },
          meaning: { type: Type.STRING },
          synonyms: { 
            type: Type.ARRAY,
            items: { type: Type.STRING }
          }
        },
        required: ["word", "meaning", "synonyms"]
      }
    }
  });

  try {
    const data = JSON.parse(response.text);
    return data;
  } catch (error) {
    console.error("Failed to parse Gemini response", error);
    return {
      word: text,
      meaning: "Não foi possível encontrar a definição.",
      synonyms: []
    };
  }
};

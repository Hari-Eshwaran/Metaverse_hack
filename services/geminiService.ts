import { GoogleGenAI, Type } from "@google/genai";
import { StyleAnalysisResponse } from "../types";

// Helper: Resize image to reduce payload size for faster API processing
const resizeImage = (file: File, maxDimension: number = 512): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDimension) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          }
        } else {
          if (height > maxDimension) {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
           reject(new Error("Could not get canvas context"));
           return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        
        // Use JPEG with 0.8 quality for optimal balance of size/quality
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

// Convert File to Base64 with resizing
export const fileToGenerativePart = async (file: File): Promise<{ inlineData: { data: string; mimeType: string } }> => {
  const base64DataUrl = await resizeImage(file);
  const base64Data = base64DataUrl.split(',')[1];
  return {
    inlineData: {
      data: base64Data,
      mimeType: 'image/jpeg',
    },
  };
};

const getAi = () => new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

// Helper to clean JSON string from markdown
const cleanJsonString = (str: string): string => {
  if (!str) return "{}";
  let cleaned = str.trim();
  // Remove markdown code blocks if present
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }
  return cleaned;
};

// Robust JSON parser that attempts to fix common LLM JSON errors (truncated, trailing commas)
const safeJsonParse = (jsonString: string): any => {
  try {
    return JSON.parse(jsonString);
  } catch (e) {
    // Attempt auto-repair
    let repaired = jsonString.trim();
    
    // Fix trailing commas
    repaired = repaired.replace(/,\s*([\]}])/g, '$1');

    // Attempt to close open strings (if odd number of quotes)
    const quoteCount = (repaired.match(/"/g) || []).length;
    if (quoteCount % 2 !== 0) {
      repaired += '"';
    }

    // Attempt to close open brackets/braces
    const openBraces = (repaired.match(/\{/g) || []).length;
    const closeBraces = (repaired.match(/\}/g) || []).length;
    const openBrackets = (repaired.match(/\[/g) || []).length;
    const closeBrackets = (repaired.match(/\]/g) || []).length;

    if (openBrackets > closeBrackets) {
      repaired += ']'.repeat(openBrackets - closeBrackets);
    }
    if (openBraces > closeBraces) {
      repaired += '}'.repeat(openBraces - closeBraces);
    }
    
    // Try parsing repaired string
    try {
      return JSON.parse(repaired);
    } catch (e2) {
       // If standard repair fails, throw original error to trigger fallback logic
       throw e;
    }
  }
};

/**
 * Step 1: Deep Style Analysis
 * Uses Gemini 2.5 Flash for high-speed multimodal analysis.
 */
export const analyzeStyle = async (
  files: File[],
  onProgress?: (status: string) => void
): Promise<StyleAnalysisResponse> => {
  const ai = getAi();
  
  // 1. Preprocessing
  if (onProgress) onProgress("Normalizing image dimensions (512px)...");
  const images = await Promise.all(files.map(fileToGenerativePart));

  // 2. Semantic Analysis
  if (onProgress) onProgress("Synthesizing style DNA with Gemini 2.5 Flash...");
  
  const prompt = `
    Analyze these reference images to extract their visual style.
    Return a single valid JSON object matching the provided schema.
    
    CRITICAL INSTRUCTIONS:
    1. STRICTLY follow the JSON schema.
    2. 'artisticStyle' and 'reasoning' must be concise (under 50 words).
    3. DO NOT include any base64 image strings or binary data.
    4. DO NOT use Markdown code blocks.
    5. The response must be pure text JSON.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [...images, { text: prompt }]
      },
      config: {
        responseMimeType: 'application/json',
        maxOutputTokens: 8192,
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            artisticStyle: { type: Type.STRING },
            visualTechnique: { type: Type.STRING },
            colorPalette: { type: Type.ARRAY, items: { type: Type.STRING } },
            moodKeywords: { type: Type.ARRAY, items: { type: Type.STRING } },
            suggestedName: { type: Type.STRING },
            reasoning: { type: Type.STRING },
          }
        }
      }
    });

    if (!response.text) throw new Error("Failed to analyze style: Empty response.");
    
    let parsed: any;
    try {
      const cleanedText = cleanJsonString(response.text);
      parsed = safeJsonParse(cleanedText);
    } catch (e: any) {
      console.error("JSON Parse Error during analysis:", e);
      
      let errorReason = "Unknown parsing error";
      if (e instanceof SyntaxError) {
         if (e.message.includes("Unterminated string")) {
             errorReason = "Response truncated (Unterminated String).";
         } else if (e.message.includes("Unexpected end of JSON")) {
             errorReason = "Response truncated (Incomplete JSON).";
         }
      }

      parsed = {
        artisticStyle: "Analyzed Visual Style",
        visualTechnique: "Mixed Digital Techniques",
        colorPalette: ["#000000", "#ffffff", "#888888"],
        moodKeywords: ["Modern", "Creative"],
        suggestedName: "Custom Style",
        reasoning: `Analysis partially recovered. (Source error: ${errorReason})`
      };
    }

    // 3. Vector Embedding (Optional & Non-blocking)
    let embedding: number[] | undefined = undefined;
    try {
      if (onProgress) onProgress("Extracting high-dimensional feature vectors...");
      
      const styleDescription = `${parsed.suggestedName}. ${parsed.artisticStyle}. ${parsed.visualTechnique}. Moods: ${parsed.moodKeywords?.join(', ')}`;
      
      const embedResponse = await ai.models.embedContent({
        model: 'text-embedding-004', 
        contents: {
          parts: [{ text: styleDescription }]
        }
      });
      // Correct property for EmbedContentResponse in the SDK is 'embeddings' (array)
      // We take the first one since we sent a single content part
      embedding = (embedResponse as any).embeddings?.[0]?.values;
      if (!embedding && (embedResponse as any).embedding) {
          // Fallback if SDK version differs from types
          embedding = (embedResponse as any).embedding.values;
      }
    } catch (e) {
      // Silently ignore embedding failures (403, 404, etc.) to keep the app working
      console.warn("Embedding generation skipped (permission/model issue):", e);
    }

    return {
      artisticStyle: parsed.artisticStyle || "Eclectic Artistic Style",
      visualTechnique: parsed.visualTechnique || "Mixed Media",
      colorPalette: Array.isArray(parsed.colorPalette) ? parsed.colorPalette : ["#888888", "#cccccc"],
      moodKeywords: Array.isArray(parsed.moodKeywords) ? parsed.moodKeywords : ["Unique"],
      suggestedName: parsed.suggestedName || "My Custom Style",
      reasoning: parsed.reasoning || "Style extracted based on visual patterns.",
      embedding: embedding
    };
  } catch (e: any) {
    // If even the basic analysis fails, we throw to let the UI know
    console.error("Critical Analysis Error:", e);
    throw new Error(e.message || "Failed to analyze style.");
  }
};

/**
 * Step 2: Intelligent Prompt Fusion
 * Uses Gemini Flash Lite for low-latency text processing.
 */
export const fusePrompt = async (
  userPrompt: string, 
  styleData: any, 
  intensity: number
): Promise<string> => {
  const ai = getAi();
  
  // Safely handle arrays
  const paletteStr = Array.isArray(styleData.palette) ? styleData.palette.join(", ") : "";
  const moodStr = Array.isArray(styleData.moods) ? styleData.moods.join(", ") : "";

  const systemInstruction = `
    Rewrite the user's prompt to apply this style:
    Technique: ${styleData.visualTechnique}
    Desc: ${styleData.description}
    Palette: ${paletteStr}
    Mood: ${moodStr}
    Intensity: ${intensity}
    
    Return ONLY the fused prompt string.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash', 
      contents: { parts: [{ text: userPrompt }] },
      config: { systemInstruction }
    });
    return response.text?.trim() || userPrompt;
  } catch (e) {
      console.warn("Fusion failed, falling back to raw prompt", e);
      return userPrompt;
  }
};

/**
 * Step 3: High-Fidelity Image Generation
 * Exclusively uses Gemini 2.5 Flash Image with MULTIMODAL style reference.
 */
export const generateStyledImage = async (
  userPrompt: string,
  fusedPrompt: string,
  referenceImages: string[],
  aspectRatio: "1:1" | "3:4" | "4:3" | "16:9",
  imageSize: "1K" | "2K" | "4K"
): Promise<string> => {
  const ai = getAi();
  const parts: any[] = [];

  // 1. Add Reference Images for Style Context
  // We feed the original style images back to the model to ensure high fidelity style transfer
  referenceImages.forEach(img => {
      // Clean base64 header if present
      const base64Data = img.replace(/^data:image\/(png|jpeg|webp);base64,/, "");
      parts.push({ 
          inlineData: { mimeType: 'image/jpeg', data: base64Data } 
      });
  });

  // 2. Add Prompt
  const finalPrompt = `
    Reference images are provided above.
    
    User Request: "${fusedPrompt}"
    
    CRITICAL STYLE INSTRUCTIONS:
    - GENERATE a new image that strictly matches the VISUAL STYLE of the reference images provided above.
    - Mimic the exact color palette, brushwork, lighting, UI elements, typography, and texture.
    - If the references are UI designs, generate a UI design. If they are paintings, generate a painting.
    - Consistency with the provided images is the highest priority.
  `;
  parts.push({ text: finalPrompt });

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts },
      config: {
        imageConfig: {
          aspectRatio: aspectRatio
          // Note: imageSize is NOT supported by Flash Image
        }
      }
    });
    return extractImage(response);
  } catch (error) {
    console.error("Image generation failed:", error);
    throw new Error("Failed to generate image. Please try again.");
  }
};

/**
 * Step 4: Image Editing (Multimodal)
 * Uses Gemini 2.5 Flash Image (Nano Banana) for text-based image editing with multiple references.
 */
export const editImage = async (
  base64Images: string[],
  editPrompt: string
): Promise<string> => {
  const ai = getAi();
  
  // Prepare content parts: images first, then text
  const parts: any[] = [];
  
  base64Images.forEach(img => {
      // Remove data URL header if present
      const base64Data = img.replace(/^data:image\/(png|jpeg|webp);base64,/, "");
      parts.push({ 
          inlineData: { mimeType: 'image/png', data: base64Data } 
      });
  });

  parts.push({ text: editPrompt });

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts },
    });
    return extractImage(response);
  } catch (e) {
    console.error("Edit failed:", e);
    throw new Error("Failed to edit image.");
  }
};

// Helper to extract image from response
const extractImage = (response: any): string => {
  const parts = response.candidates?.[0]?.content?.parts;
  if (!parts) throw new Error("No image generated.");

  for (const part of parts) {
    if (part.inlineData?.data) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  throw new Error("No image data found in response.");
};

import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const getSmartSummary = async (videoName: string, description: string) => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `提供一个简洁有趣的电影/剧集推介，名字是《${videoName}》，原始简介是：${description}。请用一段100字以内的文字概括其看点。`,
      config: {
        temperature: 0.7,
        topP: 0.8,
      },
    });
    return response.text || "暂无AI推荐理由";
  } catch (error) {
    console.error("Gemini Summary Error:", error);
    return description.slice(0, 100) + "...";
  }
};

export const getSmartRecommendations = async (history: string[]) => {
  if (history.length === 0) return ["流浪地球", "三体", "功夫"];
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `基于用户最近看的影视剧：${history.join(', ')}，推荐5个类似的影视剧名称。`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      }
    });
    return JSON.parse(response.text);
  } catch (error) {
    return ["热门电影", "热播电视剧", "动漫精选"];
  }
};

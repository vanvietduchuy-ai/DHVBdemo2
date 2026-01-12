import { GoogleGenAI, Type } from "@google/genai";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

export const GeminiService = {
  /**
   * Generates description and steps.
   */
  suggestTaskDetails: async (taskTitle: string): Promise<{ description: string; steps: string[]; dueDate?: string }> => {
    if (!apiKey) {
      return { description: "Vui lòng cấu hình API Key.", steps: [] };
    }

    try {
      const prompt = `
        Bạn là trợ lý hành chính. Với công việc: "${taskTitle}", hãy:
        1. Viết nội dung chỉ đạo (2-3 câu).
        2. Liệt kê 3 bước thực hiện.
        3. Nếu trích yếu có chứa thông tin thời gian (ví dụ: "trước ngày 20/10", "trong tháng 5"), hãy trích xuất ngày đó dưới định dạng YYYY-MM-DD. Nếu không có, để null.
        Trả về JSON.
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              description: { type: Type.STRING },
              steps: { type: Type.ARRAY, items: { type: Type.STRING } },
              dueDate: { type: Type.STRING, description: "YYYY-MM-DD or null" }
            },
            required: ["description", "steps"]
          }
        }
      });

      const text = response.text;
      return text ? JSON.parse(text) : { description: "", steps: [] };
    } catch (error) {
      return { description: "Lỗi AI.", steps: [] };
    }
  },

  /**
   * Extracts structured metadata from image, INCLUDING deadlines.
   */
  extractDocumentDetails: async (base64Image: string, mimeType: string): Promise<{
    dispatchNumber: string;
    issuingAuthority: string;
    issueDate: string;
    abstract: string;
    summary: string;
    deadline: string;
  }> => {
    if (!apiKey) throw new Error("Missing API Key");

    try {
      const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, "");

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            { inlineData: { data: cleanBase64, mimeType: mimeType } },
            { text: `Phân tích văn bản hành chính này và trả về JSON gồm:
                     1. dispatchNumber (Số hiệu)
                     2. issuingAuthority (Cơ quan ban hành)
                     3. issueDate (Ngày ban hành YYYY-MM-DD)
                     4. abstract (Trích yếu - ngắn gọn)
                     5. summary (Nội dung chỉ đạo/xử lý)
                     6. deadline (Hạn xử lý/Hoàn thành nếu có trong văn bản, định dạng YYYY-MM-DD. Nếu không tìm thấy, để rỗng)` 
            },
          ],
        },
      });

      const text = response.text;
      if (!text) return { dispatchNumber: "", issuingAuthority: "", issueDate: "", abstract: "", summary: "", deadline: "" };

      // Try to parse JSON
      const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
         return JSON.parse(jsonMatch[1] || jsonMatch[0]);
      }
      
      return { dispatchNumber: "", issuingAuthority: "", issueDate: "", abstract: text.substring(0, 100), summary: text, deadline: "" };
    } catch (error) {
      return {
        dispatchNumber: "", issuingAuthority: "", issueDate: "", 
        abstract: "Lỗi xử lý ảnh", summary: "", deadline: ""
      };
    }
  },

  generateBriefing: async (tasks: any[]): Promise<string> => {
     if (!apiKey) return "Cần có API Key.";
     try {
       const tasksStr = tasks.map(t => `- ${t.title} [Hạn: ${t.dueDate}]`).join('\n');
       const prompt = `Tóm tắt tình hình công việc cho lãnh đạo, giọng văn hành chính, trang trọng (tối đa 50 từ): \n${tasksStr}`;
       const response = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: prompt });
       return response.text || "";
     } catch (error) { return ""; }
  },

  /**
   * Generates a list of suggested tasks for officers.
   */
  generateOfficerSuggestions: async (): Promise<{ title: string; description: string }[]> => {
    if (!apiKey) {
      return [
        { title: "Kiểm tra PCCC", description: "Kiểm tra an toàn PCCC tại các hộ kinh doanh trên địa bàn." },
        { title: "Tuần tra đêm", description: "Tuần tra đảm bảo ANTT từ 22h đến 2h sáng." },
        { title: "Cập nhật dữ liệu dân cư", description: "Rà soát và cập nhật thông tin cư dân tổ 1." }
      ];
    }

    try {
      const prompt = "Đề xuất 4 công việc nghiệp vụ cụ thể, thực tế cho cảnh sát khu vực/công an phường tại Việt Nam (ví dụ: xác minh cư trú, giải quyết trật tự đô thị...). Trả về JSON.";

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                description: { type: Type.STRING }
              },
              required: ["title", "description"]
            }
          }
        }
      });

      const text = response.text;
      return text ? JSON.parse(text) : [];
    } catch (error) {
      console.error("AI Error", error);
      return [];
    }
  }
};
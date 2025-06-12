const { InferenceClient } = require("@huggingface/inference");
const { Pinecone } = require("@pinecone-database/pinecone");
const axios = require("axios");
require("dotenv").config({ path: "../.env" });
class ChatbotService {
  constructor() {
    this.hf = new InferenceClient(process.env.HUGGINGFACE_API_KEY);
    this.pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
    this.index = this.pc.index("faq-chatbot");
  }

  // Generate embeddings using Hugging Face
  async generateEmbedding(text) {
    try {
      const response = await this.hf.featureExtraction({
        model: "sentence-transformers/all-MiniLM-L6-v2",
        inputs: text,
      });
      return Array.isArray(response[0]) ? response[0] : response;
    } catch (error) {
      console.error("Error generating embedding:", error);
      throw error;
    }
  }

  // Search FAQ using Pinecone
  async searchFAQ(query, topK = 3) {
    try {
      const queryEmbedding = await this.generateEmbedding(query);

      const searchResponse = await this.index.query({
        vector: queryEmbedding,
        topK: topK,
        includeMetadata: true,
      });

      return searchResponse.matches || [];
    } catch (error) {
      console.error("Error searching FAQ:", error);
      return [];
    }
  }

  // Call Groq API
// ... inside the ChatbotService class

  // Call Groq API
  async callGroq(messages) {
    try {
      const response = await axios.post(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          model: "llama3-8b-8192", // Fast Llama model
          messages: messages,
          temperature: 0.7,
          max_tokens: 500,
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );

      return response.data.choices[0].message.content;
    } catch (error) {
      // THIS IS THE MODIFIED BLOCK
      console.error("Error calling Groq API:");
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        console.error("Response Data:", error.response.data);
        console.error("Response Status:", error.response.status);
      } else if (error.request) {
        // The request was made but no response was received
        console.error("Request Error:", error.request);
      } else {
        // Something happened in setting up the request that triggered an Error
        console.error("Error Message:", error.message);
      }
      throw error; // Still throw the error to be caught by the calling function
    }
  }

// ... rest of the file

  // Build system prompt with FAQ context
  buildSystemPrompt(faqResults) {
    let faqContext = "";
    if (faqResults.length > 0) {
      faqContext = "Based on the following FAQ information:\n\n";
      faqResults.forEach((result, index) => {
        if (result.metadata) {
          faqContext += `${index + 1}. Q: ${result.metadata.question}\n`;
          faqContext += `   A: ${result.metadata.answer}\n\n`;
        }
      });
    }

    return `You are a helpful assistant for BeMazady an auction website. You have access to FAQ information and chat history. 
    
${faqContext}

Instructions:
- Answer in Arabic if the user asks in Arabic, English if they ask in English
- Use the FAQ information when relevant to answer questions
- If the FAQ doesn't have relevant information, provide helpful general guidance
- Be concise and friendly
- If asked about auctions, buying, selling, or the platform, prioritize FAQ information`;
  }

  // Process a chat message
  async processMessage(session, userMessage) {
    try {
      // Add user message to session
      session.messages.push({
        role: "user",
        content: userMessage,
        timestamp: new Date(),
      });

      // Keep only last 10 messages (5 user + 5 assistant)
      if (session.messages.length > 10) {
        session.messages = session.messages.slice(-10);
      }

      // Search FAQ for relevant context
      const faqResults = await this.searchFAQ(userMessage, 2);

      // Build system prompt with FAQ context
      const systemPrompt = this.buildSystemPrompt(faqResults);

      // Build messages for Groq
      const groqMessages = [
        { role: "system", content: systemPrompt },
        ...session.messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
      ];

      // Get response from Groq
      const assistantResponse = await this.callGroq(groqMessages);

      // Add assistant response to session
      session.messages.push({
        role: "assistant",
        content: assistantResponse,
        timestamp: new Date(),
      });

      // Update last activity
      session.lastActivity = new Date();

      return {
        response: assistantResponse,
        faqUsed: faqResults.length > 0,
        session: session,
      };
    } catch (error) {
      console.error("Error processing message:", error);
      throw error;
    }
  }
}

module.exports = new ChatbotService();

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const { execFile } = require('child_process');
const OpenAI = require('openai');
const { Document, Packer, Paragraph, TextRun } = require('docx');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv').config();
const mongoose = require('mongoose');
const PromptLog = require('./models/PromptLog');
const { v4: uuidv4 } = require('uuid');
const rateLimit = require('express-rate-limit');
const { createClient } = require('redis');
const crypto = require('crypto');
const { Client } = require('pg');
const { PgVectorStore } = require('langchain/vectorstores/pg');
const axios = require('axios');

// ==============================
// Setup Redis Client
// ==============================
const redisClient = createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379"
});

redisClient.connect()
  .then(() => console.log("✅ Connected to Redis"))
  .catch((err) => console.error("❌ Redis connection error:", err));

// Helper function: generate cache key using SHA-256 hash
function generateCacheKey(sectionName, resumeText, jobDescription) {
  const hash = crypto.createHash('sha256').update(resumeText + jobDescription).digest('hex');
  return `covercraft:${sectionName}:${hash}`;
}

// ==============================
// Setup MongoDB Connection
// ==============================
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/covercraft', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// ==============================
// Initialize Express App and Middleware
// ==============================
const app = express();
const upload = multer();
const corsOptions = {
    origin: ['http://localhost:3001', 'https://covercraftai-frontend.onrender.com'],
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
};
app.use(cors(corsOptions));
app.use(express.json());

// Rate limiter to avoid too many requests
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again after 15 minutes'
});
app.use(limiter);

// ==============================
// OpenAI Client Setup
// ==============================
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});
console.log("API Key:", process.env.OPENAI_API_KEY);

// ==============================
// Setup PostgreSQL Connection
// ==============================
const pgClient = new Client({
  connectionString: process.env.PGVECTOR_URL, // Ensure this is set in your environment
});
pgClient.connect()
  .then(() => console.log('✅ Connected to PostgreSQL'))
  .catch(err => console.error('❌ PostgreSQL connection error:', err));

// Initialize PgVectorStore
const vectorStore = new PgVectorStore(pgClient, 'embeddings'); // 'embeddings' is the table name

// ==============================
// Endpoints
// ==============================

// Basic status endpoint
app.get('/', (req, res) => {
    res.send('Server is running');
});

// ------------------------------
// 1. Resume Upload and Parse Endpoint
// ------------------------------
app.post('/upload-resume', upload.single('resume'), async (req, res) => {
    console.log("Received file:", req.file);
    try {
        // Define the temp directory path
        const tempDir = path.join(__dirname, 'temp');
        
        // Check if the temp directory exists, if not, create it
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir);
        }

        // Save file temporarily for processing by Python unstructured script
        const tempFilePath = path.join(tempDir, req.file.originalname);
        fs.writeFileSync(tempFilePath, req.file.buffer);
        
        process.env.KMP_DUPLICATE_LIB_OK = 'TRUE';
        process.env.MKL_VERBOSE = '0';
        execFile('python', ['extract_pdf.py', tempFilePath], (error, stdout, stderr) => {
            // Delete temporary file
            fs.unlinkSync(tempFilePath);
            
            if (error) {
                console.error("Python script error:", error);
                return res.status(500).json({ error: 'Error parsing PDF with unstructured (Python)' });
            }
            try {
                // Filter out non-JSON lines
                const jsonOutput = stdout.split('\n').find(line => {
                    try {
                        JSON.parse(line);
                        return true;
                    } catch {
                        return false;
                    }
                });

                if (!jsonOutput) {
                    console.error("Failed to parse JSON output from Python");
                    return res.status(500).json({ error: 'Invalid JSON output from Python' });
                }

                const result = JSON.parse(jsonOutput);
                console.log("Parsed resume text:", result.text);
                res.json(result);
            } catch (err) {
                console.error("Failed to parse JSON output from Python:", err);
                res.status(500).json({ error: 'Error parsing output from unstructured (Python)' });
            }
        });
    } catch (error) {
        console.error("Error handling file:", error);
        res.status(500).json({ error: 'Error processing PDF file' });
    }
});

// ------------------------------
// 2. Job Description + Skill Matching Endpoint
// ------------------------------
app.post('/match-skills', async (req, res) => {
    const { resumeText, jobDescription } = req.body;
    console.log("Received resume text for matching:", resumeText);
    console.log("Received job description for matching:", jobDescription);
  
    try {
        // Create prompt that instructs to output a valid JSON with a "matches" array
        const prompt = `
        You are an expert job skills matcher. Your task is to match skills in the following resume with the requirements in the job description.
        
        Job Description: 
        ${jobDescription}
        
        Resume Text: 
        ${resumeText}
        
        Please output only a valid JSON object with a key "matches" that is an array. Each element in the array should be an object with the following keys:
        - "jobRequirement": (string) the exact text from the job description
        - "relevantExperience": (string) the relevant experience from the resume that aligns with the requirement (or "No matching experience found" if none)
        - "matchLevel": (string) one of "High", "Medium", or "Low"
        
        Do not output any additional text.
        `;
        
        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages:[
                {role: "system", content: "You are an expert job skills matcher."},
                {role: "user", content: prompt}
            ],
            max_tokens: 3000,
            temperature: 0.1
        });
        
        console.log("OpenAI API response:", response);
        
        if (!response.choices || response.choices.length === 0) {
            throw new Error("No choices returned in OpenAI response");
        }
        
        const jsonResponse = response.choices[0].message.content.trim();
        console.log("JSON Response:", jsonResponse);
        
        // Clean the response (remove any code block markers)
        const cleanedJsonResponse = jsonResponse.replace(/```json|```/g, '').trim();
        let parsedOutput;
        try {
            parsedOutput = JSON.parse(cleanedJsonResponse);
        } catch (err) {
            console.error("Failed to parse JSON response:", err);
            throw new Error("Failed to parse JSON response: " + err.message);
        }
       
        const matchedSkills = parsedOutput.matches;
        
        const requestId = uuidv4();
        const timestamp = new Date();
        
        const usage = response.usage || {
          prompt_tokens: null,
          completion_tokens: null,
          total_tokens: null,
        };
        
        await PromptLog.create({
          requestId,
          timestamp,
          style: 'Skill Matching', 
          inputs: {
            resume: resumeText,
            jobDesc: jobDescription,
          },
          prompt, 
          output: cleanedJsonResponse,
          model: response.model || 'gpt-4o',
          usage,
          finishReason: response.choices[0].finish_reason || 'unknown'
        });
        
        console.log("Parsed matched skills:", matchedSkills);        
        res.json({ matchedSkills, requestId });
    } catch (error) {
        console.error("Error matching skills with OpenAI:", error);
        res.status(500).json({ error: 'Error matching skills with OpenAI' });
    }
});

// ------------------------------
// 3. Cover Letter Section Endpoints
// ------------------------------

// Function to create prompt for each cover letter section.
// It instructs the model to output a valid JSON object with a key "options" containing an array
// where each element has "paragraph" and "explanation" keys.
const createPrompt = (sectionName, jobDescription, resumeText) => {
    console.log("Received job description for section:", jobDescription); 
    console.log("Received resume text for section:", resumeText);

    switch (sectionName) {
        case 'Open Hook':
            return `
                Write three opening paragraphs for a cover letter in the first person.
                Each paragraph should:
                - Be short, engaging, and showcase genuine enthusiasm for the company.
                - Highlight a unique connection to the company's mission, culture, or achievements.
                - Avoid any symbols like '**'.

                Job Description: ${jobDescription}
                Resume: ${resumeText}

                Please output only a valid JSON object with a key "options" that is an array.
                Each element in the array should be an object with two keys:
                - "paragraph": a string representing the paragraph content.
                - "explanation": a string explaining why this paragraph is a good option.

                Do not output any additional text.
            `;
        case 'Key Experiences':
            return `
                Write three key experiences paragraphs for a cover letter in the first person.
                Each paragraph should:
                - Highlight 2-3 specific achievements or projects from my experience.
                - Use concrete examples to showcase impact and relevance.
                - Avoid any symbols like '**'.

                Job Description: ${jobDescription}
                Resume: ${resumeText}

                Please output only a valid JSON object with a key "options" that is an array.
                Each element in the array should be an object with two keys:
                - "paragraph": a string representing the paragraph content.
                - "explanation": a string explaining why this paragraph is a good option.

                Do not output any additional text.
            `;
        case 'Personal Values':
            return `
                Write three personal values paragraphs for a cover letter in the first person.
                Each paragraph should:
                - Discuss my personal values, passions, and career aspirations.
                - Show alignment with the company's mission and the role's objectives.
                - Avoid any symbols like '**'.

                Job Description: ${jobDescription}
                Resume: ${resumeText}

                Please output only a valid JSON object with a key "options" that is an array.
                Each element in the array should be an object with two keys:
                - "paragraph": a string representing the paragraph content.
                - "explanation": a string explaining why this paragraph is a good option.

                Do not output any additional text.
            `;
        case 'Closing Statement':
            return `
                Write three closing statement paragraphs for a cover letter in the first person.
                Each paragraph should:
                - Be short, confident, and enthusiastic.
                - Reflect my unique voice and excitement for the role.
                - Avoid any symbols like '**'.

                Job Description: ${jobDescription}
                Resume: ${resumeText}

                Please output only a valid JSON object with a key "options" that is an array.
                Each element in the array should be an object with two keys:
                - "paragraph": a string representing the paragraph content.
                - "explanation": a string explaining why this paragraph is a good option.

                Do not output any additional text.
            `;
        default:
            throw new Error('Invalid section name');
    }
};

// Helper function to clean and parse JSON response (used for cover letter sections)
function parseJSONResponse(responseText) {
  // Remove any triple backticks and extra markers (e.g., ``` or ```json)
  const cleaned = responseText.replace(/```(json)?/gi, '').trim();
  try {
    const parsed = JSON.parse(cleaned);
    if (!parsed.options || !Array.isArray(parsed.options)) {
      throw new Error("Parsed JSON does not contain a valid 'options' array.");
    }
    return parsed;
  } catch (err) {
    console.error("Failed to parse JSON response. Raw response:", responseText);
    throw new Error("Failed to parse JSON response: " + err.message);
  }
}

// Define endpoints for each section
app.post('/generate-open-hook', async (req, res) => {
    await generateSection(req, res, 'Open Hook');
});

app.post('/generate-key-experiences', async (req, res) => {
    await generateSection(req, res, 'Key Experiences');
});

app.post('/generate-personal-values', async (req, res) => {
    await generateSection(req, res, 'Personal Values');
});

app.post('/generate-closing-statement', async (req, res) => {
    await generateSection(req, res, 'Closing Statement');
});


// Generic function to handle section generation with caching.
const activeRequests = new Set();

async function generateSection(req, res, sectionName) {
  const { jobDescription, resumeText } = req.body;
  const requestKey = `${jobDescription}_${resumeText}_${sectionName}`;
  
  // Prevent duplicate processing
  if (activeRequests.has(requestKey)) {
    return res.status(429).json({ error: 'Request already in progress' });
  }
  activeRequests.add(requestKey);
  
  try {
    // Generate a cache key based on inputs for caching results
    const cacheKey = generateCacheKey(sectionName, resumeText, jobDescription);
    
    // Check if a cached response exists
    const cachedData = await redisClient.get(cacheKey);
    if (cachedData) {
      console.log(`Cache hit for ${cacheKey}`);
      return res.json(JSON.parse(cachedData));
    }

    // Generate the prompt for the specified section
    const prompt = createPrompt(sectionName, jobDescription, resumeText);
    console.log(`Generating ${sectionName} with prompt...`);

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: "system",
          content: "You are an expert cover letter writer. Your task is to generate high-quality, personalized cover letter sections based on the provided job description and resume."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 2000,
      temperature: 0.1
    });

    console.log("OpenAI API response:", response);

    if (!response.choices || response.choices.length === 0) {
      throw new Error("No choices returned in OpenAI response");
    }
    const rawResponse = response.choices[0].message.content.trim();
    console.log("Raw JSON Response:", rawResponse);

    // Clean and parse the JSON response
    const parsedOutput = parseJSONResponse(rawResponse);
    const options = parsedOutput.options;

    const requestId = uuidv4();
    const timestamp = new Date();
    const usage = response.usage || {
      prompt_tokens: null,
      completion_tokens: null,
      total_tokens: null,
    };

    // Log the generated section to MongoDB
    await PromptLog.create({
      requestId,
      timestamp,
      style: sectionName,
      inputs: {
        resume: resumeText,
        jobDesc: jobDescription,
      },
      prompt,
      output: rawResponse,
      model: response.model || 'gpt-4o',
      usage,
      finishReason: response.choices[0].finish_reason || 'unknown'
    });

    // Prepare final response object
    const finalResponse = { options, requestId };
    console.log("Generated options for", sectionName, ":", options);
    
    // Cache the final response in Redis with a TTL of 1 hour (3600 seconds)
    await redisClient.set(cacheKey, JSON.stringify(finalResponse), { EX: 3600 });
    
    res.json(finalResponse);
  } catch (error) {
    console.error("Error generating section with OpenAI:", error);
    res.status(500).json({ error: 'Error generating section with OpenAI' });
  } finally {
    activeRequests.delete(requestKey);
  }
}


async function generateEmbedding(text) {
    if (!text) {
        console.error("Input text is undefined or null.");
        return null; // or handle the error as appropriate
    }

// ------------------------------
// 4. RAG: Process Document Endpoint (Node → Python proxy)
// This route extracts paragraphs from raw text, then delegates embedding + storage to Python RAG service.    
// ------------------------------
app.post('/process-document', async (req, res) => {
  const { text } = req.body; // Expecting plain text from the uploaded document
  try {
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    console.log("Parsed paragraphs:", paragraphs);

    const response = await axios.post('http://localhost:8000/process-document', { text });
    console.log('Response from Python service:', response.data);

    res.json({
      message: 'Document processed and embeddings stored',
      count: paragraphs.length,
      pythonServiceResponse: response.data
    });
  } catch (error) {
    console.error("Error processing document:", error);
    res.status(500).json({ error: 'Error processing document' });
  }
});

// ------------------------------
// 6. RAG: Query Document Endpoint (via Python microservice)
// ------------------------------
app.post('/query-document', async (req, res) => {
  const { query } = req.body;
  if (!query) return res.status(400).json({ error: 'Query text is required' });

  try {
    const response = await axios.post('http://localhost:8000/query-document', { query });
    console.log('Response from Python service:', response.data);
    res.json({
      message: 'Query documented',
      pythonServiceResponse: response.data
    });
  } catch (error) {
    console.error("Error querying document:", error.response?.data || error.message);
    res.status(500).json({ error: 'Error querying document' });
  }
});

// ------------------------------
// 7. Word Document Generation Endpoint
// ------------------------------
/*Personal Details Extraction 
app.post('/extract-details', async (req, res) => {
    const { resumeText } = req.body;
    console.log("Received resume text for details extraction.");

    try {
        const text = resumeText;

        // Extract name (first line as an example)
        const lines = text.split('\n');
        const name = lines.length > 0 ? lines[0].trim() : '[Your Name]';

        // Extract email
        const emailMatch = text.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i);
        const email = emailMatch ? emailMatch[0] : '[Your Email]';

        res.json({ name, email });
    } catch (error) {
        console.error("Error extracting details from resume:", error);
        res.status(500).json({ error: 'Error extracting details from resume' });
    }
});*/

app.post('/generate-word', async(req, res) => {
    const { coverLetter } = req.body;
    if (!coverLetter) {
        return res.status(400).json({ error: 'Cover letter content is required' });
    }
    try {
        console.log("Raw Cover Letter Content:", coverLetter);
        
        // Clean HTML tags and non-breaking spaces
        const cleanedContent = coverLetter
            .replace(/<[^>]*>/g, '')
            .replace(/\&nbsp;/g, ' ')
            .trim();
        console.log("Cleaned Content:", cleanedContent);
        
        // Split content into paragraphs
        const paragraphs = cleanedContent.split(/\n\n+/).map(paragraph => paragraph.trim());
        const formattedParagraphs = paragraphs.map(paragraph => new Paragraph({
            text: paragraph,
            spacing: { after: 200 },
            style: "Normal",
        }));
        console.log("Generated Paragraphs:", formattedParagraphs);
        
        const doc = new Document({
            creator: "Cover Letter Generator",
            title: "Generated Cover Letter",
            description: "A custom cover letter generated for job application",
            sections: [
                {
                    properties: {},
                    children: formattedParagraphs,
                },
            ],
        });
        
        const buffer = await Packer.toBuffer(doc);
        res.setHeader(
            'Content-Disposition',
            'attachment; filename=CoverLetter.docx'
        );
        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        );
        res.send(buffer);
    } catch (error) {
      console.error('Error generating Word document:', error);
      res.status(500).json({ error: 'Error generating Word document' });
    }
});

/*// ------------------------------
// 8. User Feedback Collection Endpoint
// ------------------------------
app.post('/submit-feedback', (req, res) => {
    const { rating, comments } = req.body;

    // Save feedback to database (or a JSON file for simplicity)
    const feedback = { rating, comments, date: new Date() };
    // Assuming a MongoDB setup, save feedback to a 'feedback' collection
    db.collection('feedback').insertOne(feedback, (error, result) => {
        if (error) {
            return res.status(500).json({ error: 'Error saving feedback' });
        }
        res.json({ message: 'Feedback submitted successfully' });
    });
});
*/
// ==============================
// Server Listening
// ==============================
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`Server running on ${PORT}`));

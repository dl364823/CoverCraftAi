const express = require('express');
const cors = require('cors');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const OpenAI = require('openai');
const { Document, Packer, Paragraph, TextRun } = require('docx');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv').config();
const mongoose = require('mongoose');
const PromptLog = require('./models/PromptLog');
const { v4: uuidv4 } = require('uuid');
const rateLimit = require('express-rate-limit');

// MongoDB connect
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/covercraft', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

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

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

console.log("API Key:", process.env.OPENAI_API_KEY);

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again after 15 minutes'
});

app.use(limiter);

app.get('/', (req, res) => {
    res.send('Server is running');
});

// Step1: Resume Upload and Parse [Checked]
app.post('/upload-resume', upload.single('resume'), async (req, res) => {
    console.log("Received file:", req.file);
    try {
        const data = await pdfParse(req.file.buffer);
        console.log("Parsed resume text:", data.text);
        res.json({ text: data.text });
    } catch (error) {
        console.error("Error parsing PDF:", error);
        res.status(500).json({ error: 'Error parsing PDF' });
    }
});

// Step2: Job Description + Skill Matching Endpoint [Received] []    
app.post('/match-skills', async (req, res) => {
    const { resumeText, jobDescription } = req.body;
    console.log("Received resume text for matching:", resumeText);
    console.log("Received job description for matching:", jobDescription);
  
    try {
        // Modified prompt for JSON output
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
        
        const cleanedJsonResponse = jsonResponse.replace(/```json|```/g, '');
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
  

// Step3: Cover Letter Section
// Create the Function
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

// Generic function to handle section generation
const activeRequests = new Set();

async function generateSection(req, res, sectionName) {
    const {jobDescription, resumeText } = req.body;
    const requestKey = `${jobDescription}_${resumeText}_${sectionName}`;
    // Prevent duplicate processing
    if (activeRequests.has(requestKey)) {
        return res.status(429).json({ error: 'Request already in progress' });
    }
    activeRequests.add(requestKey);
   
    
    try {
        const prompt = createPrompt(sectionName, jobDescription, resumeText);
        console.log(`Generating ${sectionName} with prompt...`);
        
        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages:[
                {role: "system",content: "You are an expert cover letter writer. Your task is to generate high-quality, personalized cover letter sections based on the provided job description and resume." },
                {role: "user",content: prompt }
            ],
            max_tokens: 2000,
            temperature: 0.1
        });

        console.log("OpenAI API response:", response);

        if (!response.choices || response.choices.length === 0) {
            throw new Error("No choices returned in OpenAI response");
        }
        const jsonResponse = response.choices[0].message.content.trim()
        console.log("JSON Response:", jsonResponse);
        
        const cleanedJsonResponse = jsonResponse.replace(/```json|```/g, '');

        let parsedOutput;
        try {
            parsedOutput = JSON.parse(cleanedJsonResponse);
        } catch (err) {
            console.error("Failed to parse JSON response:", err);
            throw new Error("Failed to parse JSON response: " + err.message);
        }

        const options = parsedOutput.options;
        if (!parsedOutput.options || !Array.isArray(parsedOutput.options)) {
            throw new Error("Invalid JSON format: 'options' key is missing or not an array.");
          }
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
          style: sectionName, 
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

        console.log("Generated options for", sectionName, ":", options);
        res.json({ options, requestId });
    } catch (error) {
        console.error("Error generating section with OpenAI:", error);
        res.status(500).json({ error: 'Error generating section with OpenAI' });
    }finally {
        activeRequests.delete(requestKey);
    }
}

/*//Step4: Personal Details Extraction 
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

//Step5: Word Document Generation 
app.post('/generate-word', async(req, res) => {
    const { coverLetter } = req.body;

    if (!coverLetter) {
        return res.status(400).json({ error: 'Cover letter content is required' });
    }
    try{
    
        console.log("Raw Cover Letter Content:", coverLetter);
        
        const cleanedContent = coverLetter
            .replace(/<[^>]*>/g, '') // Remove all HTML tags
            .replace(/\&nbsp;/g, ' ') // Replace HTML non-breaking spaces
            .trim();

        console.log("Cleaned Content:", cleanedContent);

        const paragraphs = cleanedContent.split(/\n\n+/).map(paragraph => paragraph.trim());

        const formattedParagraphs = paragraphs.map(paragraph => new Paragraph({
            text: paragraph,
            spacing: { after: 200 }, // Add spacing between paragraphs
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
        // Set headers and send the document
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

/*//Step6: User Feedback Collection 
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

//Server listen
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`Server running on ${PORT}`));

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const OpenAI = require('openai');
const { Document, Packer, Paragraph, TextRun } = require('docx');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv').config();

const app = express();
const upload = multer();

const corsOptions = {
    origin: (origin, callback) => {
            callback(null, true);
    },
    methods: ['GET', 'POST', 'OPTIONS'],     
    allowedHeaders: ['Content-Type'],                     
    credentials: true                                 
};

app.use(cors(corsOptions));
app.use(express.json());

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

console.log("API Key:", process.env.OPENAI_API_KEY);

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
        // Create a prompt for OpenAI to extract relevant skills
        const prompt = `
        You are an expert job skills matcher. Your task is to match skills in the following resume with the requirements in the job description.
        
        Job Description: 
        ${jobDescription}
        
        Resume Text: 
        ${resumeText}
        
        Please create a structured table in markdown format with two columns:
        - **Job Requirement** (exact text from the job description).
        - **Relevant Skills/Experience** (relevant experience from the resume that aligns with each job requirement, with a brief description explaining the relevance).
         - **Match Level** (High, Medium, or Low, based on how well the experience matches the requirement).
        
        Ensure each row in the table represents one job requirement matched with one relevant skill or experience from the resume. If there is no match, write "No matching experience found" in the "Relevant Skills / Experience" column. Follow this format exactly:

        | Job Requirement                         | Relevant Skills / Experience                                                | Match Level |
        |-----------------------------------------|-----------------------------------------------------------------------------|-------------|
        | Proficiency in JavaScript               | Proficient in JavaScript (ES6+) with experience in frameworks like React.js.| High        |
        | Experience with Python                  | Familiar with Python for data analysis and automation tasks.                | Medium      |
        | Expertise in cloud infrastructure       | No matching experience found                                                | Low         |
                
        Only output the table and nothing else.
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

        const matchedSkillsText = response.choices[0].message.content.trim();
        console.log("Matched skills:", matchedSkillsText);

        const rows = matchedSkillsText
            .split('\n')
            .filter(line => line.startsWith('|') && line.includes('|') && !line.includes('---')) // Only include lines that appear to be table rows
            .map(line => line.split('|').map(cell => cell.trim()));

        // Extract structured data from parsed rows
        const matchedSkills = rows.slice(1).map(row => {
            return {
                jobRequirement: row[1] || 'Unknown Requirement',  // Ensure column indexes match the format
                relevantExperience: row[2] || 'No matching experience found',
                matchLevel: row[3] || 'Low'
            };
        });

        console.log("Structured matched skills:", matchedSkills);

        res.json({ matchedSkills });
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
                - Avoid any symbols like '**' 

                Job Description: ${jobDescription}
                Resume: ${resumeText}

                **Format the output as:
                    Option 1:
                    [Paragraph]

                    Why Choose This: [Explanation]

                    Option 2:
                    [Paragraph]

                    Why Choose This: [Explanation]

                    Option 3:
                    [Paragraph]

                    Why Choose This: [Explanation]**
                **
                Learn from the examples to ensure the contents you generated sound natural, authentic, and true to user's personality, avoiding generic or AI-like language:
                - Example1: I was so excited to see your post on LinkedIn because it's exactly the type of job I'm looking for: an opportunity to bring my experience with video production and enthusiasm for storytelling to an organization that sets the standard for high-quality management content.
                - Example2: I am a second year master’s student in MIT’s Technology and Policy Program (TPP) writing to apply for a consulting position in Navigant’s Emerging Technology & Business Strategy group. After speaking with John Smith at the MIT career fair, I realized that Navigant’s values of excellence, continuous development, entrepreneurial spirit, and integrity align with the principles that guide me every day and that have driven me throughout my career. Moreover, I believe that my knowledge of the energy sector, passion for data analysis, polished communication skills, and four years of consulting experience will enable me to deliver superior value for Navigant’s clients.
            `;

        case 'Key Experiences':
            return `
                Write three key experiences paragraphs for a cover letter in the first person.
                Each paragraph should:
                - Highlight 2-3 specific achievements or projects from my experience.
                - Use concrete examples to showcase impact and relevance.
                - Avoid any symbols like '**' 
                
                Job Description: ${jobDescription}
                Resume: ${resumeText}

                **Format the output as:
                    Option 1:
                    [Paragraph]

                    Why Choose This: [Explanation]

                    Option 2:
                    [Paragraph]

                    Why Choose This: [Explanation]

                    Option 3:
                    [Paragraph]

                    Why Choose This: [Explanation]**
                **
                Learn from the examples to ensure the contents you generated sound natural, authentic, and true to user's personality, avoiding generic or AI-like language:
                - Example1: In addition to five years of experience in broadcast journalism, research, and video production, I would bring an organized and systems-level perspective to this role. I view video production as a puzzle, and like to think about which parts need to come together in order to make a great final product. My approach is to have in-depth conversations with my team members, and the various stakeholders, before each project. This helps me nail down the logistics — from location to talent. From there, the fun begins: fleshing out the concept and identifying what visuals will best represent it. Ideation and storyboarding are essential in this step. I know I'm not right all the time, so I enjoy working with a diverse team that can bring in new perspectives, brainstorm, and pitch ideas that will make the final product stronger. Whenever possible, I also try to seek out other sources for inspiration, like magazines, which allow me to observe different ways of expression and storytelling. This approach has served me well. It's what has allowed me to enter the film industry and grow as a creator. On my website, you can see examples of how I use the above process to create fun, engaging content.
                - Example2: As a graduate student in MIT’s Technology and Policy Program, I spend every day at the cutting edge of the energy sector. In my capacity as an MIT Energy Initiative research assistant, I use statistical analysis to investigate trends in public acceptance and regulation related to emerging energy technologies. Graduate classes in data science, energy economics, energy ventures and strategy, and technology policy have prepared me to help Navigant offer the expert services that set it apart from competitors. Furthermore, I will bring Navigant the same leadership skills that I used as the student leader for the MIT Energy Conference’s Technology Commercialization round-table, and as the mentorship manager for the MIT Clean Energy Prize.
                - Example3: Even before MIT, my four years of work experience in consulting—first at LMN Research Group and then at XYZ Consulting—allowed me to develop the skillset that Navigant looks for in candidates. As a science writer and policy analyst at LMN Research Group, I developed superb technical writing and visual communication skills, as well as an ability to communicate and collaborate with clients at federal agencies such as EPA and DOE. As a research analyst at XYZ Consulting, I developed an in-depth understanding of data analysis, program evaluation, and policy design.
                `;
        case 'Personal Values':
            return `
                Write three personal vlaues paragraphs for a cover letter in the first person.
                Each paragraph should:
                - Discuss my personal values, passions, and career aspirations.
                - Show alignment with the company's mission and the role's objectives.
                - Avoid any symbols like '**' 
                
                Job Description: ${jobDescription}
                Resume: ${resumeText}
                **Format the output as:
                    Option 1:
                    [Paragraph]

                    Why Choose This: [Explanation]

                    Option 2:
                    [Paragraph]

                    Why Choose This: [Explanation]

                    Option 3:
                    [Paragraph]

                    Why Choose This: [Explanation]**
                **    
                Learn from the examples to ensure the contents you generated sound natural, authentic, and true to user's personality, avoiding generic or AI-like language:
                - Example1: Given this experience and my enthusiasm for the work you do, I believe I'd make a great addition to your team. I recently had a chance to try out your Patient Zero product at my current organization. The simulation is both challenging and engaging. I was impressed by your ability to apply  different storytelling methods to an online training course (which, let's admit, can often be a little dry). Your work exemplifies exactly what I believe: There's an opportunity to tell a compelling story in everything — all you have to do is deliver it right.
                `;
        case 'Closing Statement':
            return `
                Write three closing statement paragraphs for a cover letter in the first person.
                Each paragraph should:
                - Be short, confident, and enthusiastic.
                - Reflect my unique voice and excitement for the role.
                - Avoid any symbols like '**' 
                
                Job Description: ${jobDescription}
                Resume: ${resumeText}
                **Format the output as:
                    Option 1:
                    [Paragraph]

                    Why Choose This: [Explanation]

                    Option 2:
                    [Paragraph]

                    Why Choose This: [Explanation]

                    Option 3:
                    [Paragraph]

                    Why Choose This: [Explanation]**

                **  
                Learn from the examples to ensure the contents you generated sound natural, authentic, and true to user's personality, avoiding generic or AI-like language:
                - Example1: I'd love to come in and speak with you more about what I'd be able to offer in this role. Harvard Business Publishing is my top choice and I believe I'd make valuable contributions to your team. Thank you for your time and consideration!
                - Example2: I take pride in my skills and experience in several domains: critical thinking and analysis, communication, and leadership. I note that Navigant values these same ideals, and I very much hope to use my abilities in service of the firm and its clients. Thank you for your time and consideration, I look forward to speaking with you further about my qualifications.
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
        const content = response.choices[0].message.content.trim()
        const options = content 
            .split(/Option \d+:/)
            .map(optionText => optionText.trim())
            .filter(optionText => optionText)
            .map(optionText => {
                const [paragraph, ...reasonParts] = optionText.split('Why Choose This:');
                const reason = reasonParts.join('Why Choose This:').trim();
                return {
                    option: paragraph.trim(),
                    reason: reason,
                };
            });

        console.log("Generated options for", sectionName, ":", options);
        res.json({ options });
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
app.listen(PORT, () => console.log(`Server running on ${PORT}`));
import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';

function UploadResume({ setResumeText, setJobDescription, setMatchedSkills }) {
    const [resumeFile, setResumeFile] = useState(null);
    const [jobDescriptionLocal, setJobDescriptionLocal] = useState('');
    const [loading, setLoading] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();

    
    
    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file && file.type !== "application/pdf") {
            setError("Only PDF files are allowed.");
            setResumeFile(null);
            return;
        }
        if (file && file.size > 5 * 1024 * 1024) {
            setError("File size should not exceed 5 MB.");
            setResumeFile(null);
            return;
        }
        setResumeFile(file);
        setSuccessMessage('');
        setError('');
    };

    const handleUpload = async () => {
        setLoading(true);
        setError('');
        setSuccessMessage('');

        if (!resumeFile || !jobDescriptionLocal) {
            setError("Please upload a resume and enter a job description.");
            setLoading(false);
            return;
        }

        try{
            const formData = new FormData();
            formData.append('resume', resumeFile);
            const resumeTextResponse = await api.post('/upload-resume', formData, { 
                headers: { 'Content-Type': 'multipart/form-data' } 
            });
            const resumeText = resumeTextResponse.data.text;
            setResumeText(resumeText);
            setJobDescription(jobDescriptionLocal);
            const matchResponse = await api.post('/match-skills', { 
                resumeText, 
                jobDescription: jobDescriptionLocal
            });
            setMatchedSkills(matchResponse.data.matchedSkills);
            setSuccessMessage("File uploaded successfully!"); 
            navigate('/comparison');
        } catch (error) {
            console.error('Error uploading resume:', error);
            setError('Failed to upload resume or match skills. Please try again.');
        }finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-lg max-w-2xl mx-auto">
            <h2 className="text-2xl font-semibold mb-6 text-gray-800">Upload Your Resume</h2>

            {/* Dropzone for File Upload */}
            <div className="flex items-center justify-center w-full mb-4">
                <label 
                    htmlFor="dropzone-file" 
                    className="flex flex-col items-center justify-center w-full h-48 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100"
                >
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <svg className="w-10 h-10 mb-3 text-gray-400" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 16">
                            <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2"/>
                        </svg>
                        <p className="mb-2 text-sm text-gray-500"><span className="font-semibold">Click to upload</span> or drag and drop</p>
                        <p className="text-xs text-gray-500">PDF format only (MAX. 5MB)</p>
                    </div>
                    <input id="dropzone-file" type="file" className="hidden" onChange={handleFileChange} />
                </label>
            </div>

             {/* File Display */}
            {resumeFile && (
                <p className="text-sm text-gray-700 mb-4">Selected file: {resumeFile.name}</p>
            )}

            {/* Job Description Input */}
            <div className="mb-4">
                <label htmlFor="job-description" className="block mb-2 text-sm font-semibold font-medium text-gray-700">Job Description</label>
                <textarea 
                    id="job-description"
                    value={jobDescriptionLocal} 
                    onChange={(e) => setJobDescriptionLocal(e.target.value)} 
                    placeholder="Paste job description here" 
                    className="w-full p-4 border border-gray-300 rounded-lg bg-gray-50 text-base focus:ring-blue-500 focus:border-blue-500"
                    rows="6"
                />
            </div>

            {/* Upload Button */}
            <button 
                onClick={handleUpload} 
                disabled={loading} 
                className={`w-full py-3 px-4 font-semibold rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                    loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-gray-800 text-white hover:bg-blue-400'
                }`}
            >
                {loading ? 'Uploading...' : 'Upload and Analyze'}
            </button>

            {/* Error Message */}
            {error && <p className="mt-4 text-sm text-red-500">{error}</p>}
        </div>
    );
}


export default UploadResume;

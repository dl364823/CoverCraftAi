import React, { useState, useEffect } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import './DownloadCoverLetter.css';
import { htmlToText } from 'html-to-text';
import axios from 'axios';
import { useNavigate, Navigate } from 'react-router-dom';


function DownloadCoverLetter({ selectedSections, coverLetter, setCoverLetter, resumeText }) {
  const navigate = useNavigate();
  const [content, setContent] = useState('');
  const [personalDetails, setPersonalDetails] = useState({
    name: '',
    address: '',
    cityStateZip: '',
    email: '',
    phoneNumber: '',
  });
  const currentDate = new Date().toLocaleDateString();
  const requiredSections = ['Open Hook', 'Key Experiences', 'Personal Values', 'Closing Statement'];
  const allSectionsCompleted = requiredSections.every(section => selectedSections[section]);
  const [isDownloading, setIsDownloading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);

  useEffect(() => {
    const extractPersonalDetails = () => {
      if (resumeText) {
        // Split text into lines and remove empty lines
        const lines = resumeText.split('\n').map(line => line.trim()).filter(line => line !== '');
        
        // Extract name (assumed to be the first non-empty line)
        const name = lines.length > 0 ? lines[0] : '[Your Name]';

        // Extract email
        const emailMatch = resumeText.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i);
        const email = emailMatch ? emailMatch[0] : '[Your Email]';

        // Extract phone number
        const phoneMatch = resumeText.match(/(\+?\d{1,3}[-.\s]?|\()?\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/);
        const phoneNumber = phoneMatch ? phoneMatch[0] : '[Your Phone Number]';

        // Set the extracted details
        setPersonalDetails(prevDetails => ({
          ...prevDetails,
          name,
          email,
          phoneNumber,
          address: '[Your Address]',
          cityStateZip: '[City, State ZIP]'
        }));
      }
    };

    extractPersonalDetails();
  }, [resumeText]);

  useEffect(() => {
    const initialContent = `
${personalDetails.name || '[Your Name]'}<br />
${personalDetails.address || '[Your Address]'}<br />
${personalDetails.email || '[Your Email]'}<br />
${personalDetails.phoneNumber || '[Your Phone Number]'}<br />
${currentDate}<br /><br />

Dear Hiring Manager,<br /><br />
${selectedSections['Open Hook'] || ''}<br /><br />
${selectedSections['Key Experiences'] || ''}<br /><br />
${selectedSections['Personal Values'] || ''}<br /><br />
${selectedSections['Closing Statement'] || ''}<br /><br />

Sincerely,<br />
${personalDetails.name || '[Your Name]'}<br />
    `;
    setContent(initialContent);
    setCoverLetter(initialContent);
  }, [personalDetails, currentDate, selectedSections, setCoverLetter]);

  if (!allSectionsCompleted) {
    return <Navigate to="/cover-letter-section" replace />;
  }
  
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setPersonalDetails(prev => ({ ...prev, [name]: value }));
  };

  // Handle changes in editor
  const handleContentChange = (value) => {
    setContent(value);
    setCoverLetter(value);
  };

  // Toolbar options for the editor
  const toolbarOptions = [
    [{ 'header': '1' }, { 'header': '2' }, { 'font': [] }],
    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
    ['bold', 'italic', 'underline'],
    [{ 'align': [] }],
    ['link'],
    ['clean']                                         
  ];

  const handleDownload = async () => {
    setIsDownloading(true);
    setErrorMessage('');
    try {
      const response = await axios.post(
        'http://localhost:3000/generate-word',
        { coverLetter: content },
        { responseType: 'blob' }
      );
  
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'CoverLetter.docx');
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      
      setShowSuccessMessage(true);
      setTimeout(() => setShowSuccessMessage(false), 3000);
    } catch (error) {
      console.error('Error downloading Word document:', error);
      setErrorMessage('Failed to download the document. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      {/* Main Container */}
      <div className="max-w-4xl mx-auto">
        {/* Navigation Header */}
        <div className="flex justify-between items-center mb-8 px-6">
          <button
            onClick={() => navigate('/upload-resume')}
            className="group flex items-center text-gray-600 hover:text-blue-600 transition-colors"
          >
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className="h-5 w-5 mr-2 transform group-hover:-translate-x-1 transition-transform" 
              viewBox="0 0 20 20" 
              fill="currentColor"
            >
              <path 
                fillRule="evenodd" 
                d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" 
                clipRule="evenodd" 
              />
            </svg>
            Back to Resume Upload
          </button>
          
          <div className="text-right">
            <h1 className="text-2xl font-bold text-gray-900">Final Step</h1>
            <p className="text-sm text-gray-600">Review and Download your Cover Letter</p>
          </div>
        </div>

        {/* Main Content Card */}
        <div className="bg-white rounded-xl shadow-lg p-8">
          {/* Success Message */}
          {showSuccessMessage && (
            <div className="mb-6 p-4 bg-green-100 border border-green-400 text-green-700 rounded-lg flex items-center">
              <svg 
                className="h-5 w-5 mr-2" 
                fill="currentColor" 
                viewBox="0 0 20 20"
              >
                <path 
                  fillRule="evenodd" 
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" 
                  clipRule="evenodd"
                />
              </svg>
              <span>Cover letter downloaded successfully!</span>
            </div>
          )}

          {/* Personal Details Section */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4 flex items-center text-gray-800">
              <svg 
                className="h-5 w-5 mr-2" 
                fill="none" 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth="2" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Personal Information
            </h2>
            
            <div className="grid gap-4 md:grid-cols-2">
              {/* Name Input */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Full Name
                </label>
                <input
                  type="text"
                  name="name"
                  value={personalDetails.name}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="John Doe"
                />
              </div>

              {/* Email Input */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Email Address
                </label>
                <input
                  type="email"
                  name="email"
                  value={personalDetails.email}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="john@example.com"
                />
              </div>

              {/* Phone Input */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Phone Number
                </label>
                <input
                  type="tel"
                  name="phoneNumber"
                  value={personalDetails.phoneNumber}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="+1 (555) 000-0000"
                />
              </div>

              {/* Address Input */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Address
                </label>
                <input
                  type="text"
                  name="address"
                  value={personalDetails.address}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="123 Main St, NY, 10001"
                />
              </div>
            </div>
          </div>

          {/* Cover Letter Content Section */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4 flex items-center text-gray-800">
              <svg 
                className="h-5 w-5 mr-2" 
                fill="none" 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth="2" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Cover Letter Preview
            </h2>
            
            <div className="border rounded-lg bg-gray-50">
              <ReactQuill
                value={content}
                onChange={handleContentChange}
                modules={{ 
                  toolbar: [
                    [{ 'header': [1, 2, false] }],
                    ['bold', 'italic', 'underline'],
                    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                    [{ 'align': [] }],
                    ['clean']
                  ] 
                }}
                className="bg-white rounded-lg min-h-[400px]"
              />
            </div>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg flex items-center">
              <svg 
                className="h-5 w-5 mr-2" 
                fill="currentColor" 
                viewBox="0 0 20 20"
              >
                <path 
                  fillRule="evenodd" 
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" 
                  clipRule="evenodd"
                />
              </svg>
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Download Section */}
          <div className="text-center pt-6 border-t">
            <button
              onClick={handleDownload}
              disabled={isDownloading}
              className={`
                w-full max-w-md
                py-4 px-8
                text-lg font-semibold
                text-white
                bg-gray-700 hover:bg-blue-400
                rounded-xl
                shadow-lg hover:shadow-xl
                transform transition-all duration-200 hover:-translate-y-1
                disabled:opacity-50 disabled:cursor-not-allowed
                flex items-center justify-center
              `}
            >
              {isDownloading ? (
                <>
                  <svg 
                    className="animate-spin h-5 w-5 mr-3" 
                    xmlns="http://www.w3.org/2000/svg" 
                    fill="none" 
                    viewBox="0 0 24 24"
                  >
                    <circle 
                      className="opacity-25" 
                      cx="12" 
                      cy="12" 
                      r="10" 
                      stroke="currentColor" 
                      strokeWidth="4"
                    />
                    <path 
                      className="opacity-75" 
                      fill="currentColor" 
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Generating Document...
                </>
              ) : (
                <>
                  <svg 
                    className="h-6 w-6 mr-2" 
                    fill="none" 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth="2" 
                    viewBox="0 0 24 24" 
                    stroke="currentColor"
                  >
                    <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download Cover Letter
                </>
              )}
            </button>
            
            <p className="mt-4 text-sm text-gray-600">
              Your cover letter will be downloaded as a Microsoft Word document (.docx)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DownloadCoverLetter;
